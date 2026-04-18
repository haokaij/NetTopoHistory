# ============================================================
# Dockerfile - NetTopoHistory 生产环境构建
# ============================================================

# 构建阶段
FROM node:24-alpine AS builder

WORKDIR /app

# 安装依赖
COPY package.json pnpm-lock.yaml* ./
RUN npm install -g pnpm@9 && \
    pnpm install --frozen-lockfile

# 复制源码
COPY . .

# 构建应用
RUN pnpm build

# 生产阶段
FROM node:24-alpine AS runner

WORKDIR /app

# 创建非 root 用户
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# 安装纯运行时依赖
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# 设置环境变量
ENV PORT=5000
ENV NODE_ENV=production
ENV HOSTNAME="0.0.0.0"

# 切换用户
USER nextjs

# 暴露端口
EXPOSE 5000

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:5000 || exit 1

# 启动命令
CMD ["node", "server.js"]
