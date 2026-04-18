// ============================================================
// NetTopoHistory IndexedDB 数据库服务
// 基于 Dexie.js 实现前端持久化存储
// ============================================================

import Dexie, { type Table } from 'dexie';
import type { Topology, ChangeRecord, Snapshot, SshTemplate } from '@/types';

// 数据库表定义
interface SettingsRecord {
  key: string;
  value: unknown;
}

class NetTopoDB extends Dexie {
  // 拓扑表 - 存储当前拓扑和历史版本
  topologies!: Table<Topology & { id: string }>;
  // 变更记录表
  changes!: Table<ChangeRecord>;
  // 快照表
  snapshots!: Table<Snapshot>;
  // SSH 模板表
  templates!: Table<SshTemplate>;
  // 设置表
  settings!: Table<SettingsRecord>;

  constructor() {
    super('NetTopoHistoryDB');

    this.version(1).stores({
      // topologies 表：id 为主键，按 lastUpdated 索引用于查询历史
      topologies: 'id, lastUpdated',
      // changes 表：id 为主键，按 timestamp 和 type 索引用于筛选
      changes: 'id, timestamp, type',
      // snapshots 表：id 为主键，按 timestamp 和 permanent 索引
      snapshots: 'id, timestamp, permanent',
      // templates 表：id 为主键，按 name 索引
      templates: 'id, name',
      // settings 表：key 为主键
      settings: 'key'
    });
  }
}

// 创建单例数据库实例
const db = new NetTopoDB();

// ============================================================
// 拓扑操作
// ============================================================

/**
 * 保存当前拓扑到数据库
 * @param topology 拓扑数据
 */
export async function saveTopology(topology: Topology): Promise<string> {
  const id = topology.nodes.length > 0 ? 'current' : 'empty';
  await db.topologies.put({ ...topology, id });
  return id;
}

/**
 * 获取当前拓扑
 */
export async function getCurrentTopology(): Promise<Topology | null> {
  return (await db.topologies.get('current')) || null;
}

/**
 * 获取所有历史拓扑版本
 */
export async function getAllTopologyVersions(): Promise<Array<Topology & { id: string }>> {
  return db.topologies.orderBy('lastUpdated').reverse().toArray();
}

/**
 * 按 ID 获取特定拓扑版本
 */
export async function getTopologyById(id: string): Promise<Topology | null> {
  const result = await db.topologies.get(id);
  return result || null;
}

/**
 * 删除指定拓扑版本
 */
export async function deleteTopology(id: string): Promise<void> {
  await db.topologies.delete(id);
}

// ============================================================
// 变更记录操作
// ============================================================

/**
 * 添加变更记录
 * @param record 变更记录
 */
export async function addChangeRecord(record: ChangeRecord): Promise<string> {
  await db.changes.add(record);
  return record.id;
}

/**
 * 获取所有变更记录（按时间倒序）
 */
export async function getAllChangeRecords(): Promise<ChangeRecord[]> {
  return db.changes.orderBy('timestamp').reverse().toArray();
}

/**
 * 按类型筛选变更记录
 */
export async function getChangeRecordsByType(
  type: ChangeRecord['type']
): Promise<ChangeRecord[]> {
  return db.changes.where('type').equals(type).reverse().sortBy('timestamp');
}

/**
 * 按时间范围筛选变更记录
 */
export async function getChangeRecordsByTimeRange(
  startTime: string,
  endTime: string
): Promise<ChangeRecord[]> {
  return db.changes
    .where('timestamp')
    .between(startTime, endTime, true, true)
    .reverse()
    .sortBy('timestamp');
}

/**
 * 获取变更记录数量
 */
export async function getChangeRecordsCount(): Promise<number> {
  return db.changes.count();
}

/**
 * 删除指定变更记录
 */
export async function deleteChangeRecord(id: string): Promise<void> {
  await db.changes.delete(id);
}

/**
 * 清空所有变更记录
 */
export async function clearChangeRecords(): Promise<void> {
  await db.changes.clear();
}

/**
 * 导出变更记录为 JSON
 */
export async function exportChangeRecords(): Promise<string> {
  const records = await getAllChangeRecords();
  return JSON.stringify(records, null, 2);
}

/**
 * 从 JSON 导入变更记录
 */
export async function importChangeRecords(json: string): Promise<number> {
  const records: ChangeRecord[] = JSON.parse(json);
  await db.changes.bulkPut(records);
  return records.length;
}

// ============================================================
// 快照操作
// ============================================================

/**
 * 添加快照记录
 * @param snapshot 快照数据
 */
export async function addSnapshot(snapshot: Snapshot): Promise<string> {
  await db.snapshots.add(snapshot);
  return snapshot.id;
}

/**
 * 获取所有快照（按时间倒序）
 */
export async function getAllSnapshots(): Promise<Snapshot[]> {
  return db.snapshots.orderBy('timestamp').reverse().toArray();
}

/**
 * 获取指定快照
 */
export async function getSnapshotById(id: string): Promise<Snapshot | null> {
  return (await db.snapshots.get(id)) || null;
}

/**
 * 标记快照为永久保留
 */
export async function setSnapshotPermanent(id: string, permanent: boolean): Promise<void> {
  await db.snapshots.update(id, { permanent });
}

/**
 * 删除指定快照
 */
export async function deleteSnapshot(id: string): Promise<void> {
  await db.snapshots.delete(id);
}

/**
 * 清理过期快照（保留最近 N 个非永久快照）
 * @param keepCount 保留数量
 */
export async function cleanupOldSnapshots(keepCount: number = 72): Promise<number> {
  const allSnapshots = await getAllSnapshots();
  const permanentSnapshots = allSnapshots.filter((s) => s.permanent);
  const temporarySnapshots = allSnapshots.filter((s) => !s.permanent);

  // 保留数量 = 永久快照 + 最近的临时快照
  const snapshotsToKeep = keepCount - permanentSnapshots.length;
  const snapshotsToDelete = temporarySnapshots.slice(snapshotsToKeep);

  for (const snapshot of snapshotsToDelete) {
    await deleteSnapshot(snapshot.id);
  }

  return snapshotsToDelete.length;
}

/**
 * 获取快照数量
 */
export async function getSnapshotsCount(): Promise<number> {
  return db.snapshots.count();
}

// ============================================================
// SSH 模板操作
// ============================================================

/**
 * 添加 SSH 模板
 */
export async function addSshTemplate(template: SshTemplate): Promise<string> {
  await db.templates.add(template);
  return template.id;
}

/**
 * 获取所有 SSH 模板
 */
export async function getAllSshTemplates(): Promise<SshTemplate[]> {
  return db.templates.toArray();
}

/**
 * 更新 SSH 模板
 */
export async function updateSshTemplate(
  id: string,
  updates: Partial<SshTemplate>
): Promise<void> {
  await db.templates.update(id, updates);
}

/**
 * 删除 SSH 模板
 */
export async function deleteSshTemplate(id: string): Promise<void> {
  await db.templates.delete(id);
}

// ============================================================
// 设置操作
// ============================================================

/**
 * 获取设置值
 */
export async function getSetting<T>(key: string, defaultValue: T): Promise<T> {
  const record = await db.settings.get(key);
  return (record?.value as T) ?? defaultValue;
}

/**
 * 保存设置值
 */
export async function setSetting<T>(key: string, value: T): Promise<void> {
  await db.settings.put({ key, value });
}

/**
 * 删除设置
 */
export async function deleteSetting(key: string): Promise<void> {
  await db.settings.delete(key);
}

// ============================================================
// 数据库初始化与清理
// ============================================================

/**
 * 清空所有数据（用于重置）
 */
export async function clearAllData(): Promise<void> {
  await Promise.all([
    db.topologies.clear(),
    db.changes.clear(),
    db.snapshots.clear(),
    db.templates.clear(),
    db.settings.clear()
  ]);
}

/**
 * 获取数据库统计信息
 */
export async function getDatabaseStats(): Promise<{
  topologies: number;
  changes: number;
  snapshots: number;
  templates: number;
}> {
  const [topologies, changes, snapshots, templates] = await Promise.all([
    db.topologies.count(),
    db.changes.count(),
    db.snapshots.count(),
    db.templates.count()
  ]);

  return { topologies, changes, snapshots, templates };
}

// 导出数据库实例供外部使用
export { db };
