# 香港航班查询系统（HK Flight Finder）

一个基于 **Express + Pug + 原生 JS/CSS** 的航班查询网站示例，支持查询、筛选、排序、收藏、最近查询历史、航班详情时间轴，以及中英双语切换。

## 功能特性

- 查询与筛选
  - 支持关键词查询（航班号 / 航司 / 城市）
  - 支持到港/离港、日期、状态、航站楼筛选
  - 支持排序（时间升序/降序、状态优先级）
- 结果展示
  - 移动端卡片视图
  - 桌面端表格 + 卡片混合视图
  - 分页展示
- 详情弹窗
  - 展示航站楼、登机口、行李转盘、机型
  - 展示状态时间轴
- 本地持久化（localStorage）
  - 收藏航班
  - 最近查询（最多 10 条）
  - 语言偏好
- 多语言
  - 中文 / English 即时切换并持久化
- 响应式适配
  - 手机（<=768）/ 平板（769-1024）/ 桌面（>1024）

## 技术栈

- Node.js
- Express 4
- Pug
- 原生 JavaScript / CSS

## 快速开始

### 1) 安装依赖

```powershell
cd C:\Users\lenovo\Downloads\4
npm.cmd install
```

> 在部分 Windows PowerShell 环境下，直接 `npm install` 可能因为执行策略报错，请使用 `npm.cmd install`。

### 2) 启动项目

```powershell
npm.cmd start
```

### 3) 访问地址

- 查询首页：`http://localhost:8080/flights/search`
- 结果页：`http://localhost:8080/flights/results`
- 收藏与历史：`http://localhost:8080/flights/saved`

## 主要路由

### 页面路由

- `GET /`：重定向到 `/flights/search`
- `GET /flights/search`：查询首页
- `GET /flights/results`：结果页
- `GET /flights/saved`：收藏与历史页

### API 路由

- `GET /api/flights`
  - 查询参数：
    - `keyword`：关键词
    - `type`：`arrival` | `departure`
    - `date`：`YYYY-MM-DD`
    - `status`：`on_time | delayed | boarding | landed | departed | cancelled`
    - `terminal`：`T1 | T2`
    - `sort`：`time_asc | time_desc | status`
    - `page`：页码（默认 1）
    - `ids`：按 id 逗号传入（用于收藏页批量获取）
- `GET /api/flights/:id`
  - 返回单个航班详情及时间轴

## 本地存储键名

- `hk_flights_favorites`：收藏航班 ID 列表
- `hk_flights_history`：最近查询历史（最多 10 条）
- `hk_flights_locale`：语言偏好（`zh` / `en`）

## 项目结构

```text
.
├─ index.js                 # 服务入口、页面路由、API、筛选排序逻辑
├─ data/
│  └─ flights.json          # 本地模拟航班数据
├─ views/
│  ├─ layout.pug            # 公共布局（导航、语言切换、详情弹窗）
│  ├─ search.pug            # 查询首页
│  ├─ results.pug           # 结果页
│  ├─ saved.pug             # 收藏与历史页
│  └─ notfound.pug          # 404 页面
└─ static/
   ├─ styles.css            # 全站样式与响应式布局
   └─ app.js                # 前端交互逻辑（筛选/分页/收藏/历史/多语言）
```

## 说明与注意事项

- 当前版本使用本地模拟数据，不依赖第三方实时航班 API。
- 旧作业遗留文件（如 `views/login.pug`、`views/getscore.pug`、`views/courseinfo.pug`、`static/loginstyles.css` 等）不再是主流程入口。
- 若数据中的中文文本出现不可恢复字符，前后端会自动回退到英文字段，避免页面出现乱码。

## 常见问题

### 1) 中文显示乱码

建议按以下顺序排查：

- 确认文件编码为 UTF-8（无 BOM / 或 UTF-8 均可）
- 清空浏览器缓存后强刷（`Ctrl + F5`）
- 重启服务

### 2) PowerShell 下 npm 无法执行

如果看到 `npm.ps1 cannot be loaded`，改用：

```powershell
npm.cmd install
npm.cmd start
```

## License

MIT

