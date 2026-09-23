# 电话号码管理系统

Node.js + MySQL 实现的电话号码管理工具。支持 Excel 导入、模糊搜索、状态筛选、分页，兼容 H5 移动端。

## 技术栈

- 后端: Node.js + Express + MySQL (mysql2)
- Excel解析: ExcelJS
- 文件上传: Multer
- 前端: 原生 HTML/CSS/JS

## 本地运行

```bash
npm install
mysql -u root -p < sql/init.sql
export MYSQLHOST=localhost
export MYSQLPORT=3306
export MYSQLUSER=root
export MYSQLPASSWORD=your_password
export MYSQLDATABASE=phone_manager
export ACCESS_PASSWORD=your_login_password
npm start
```

访问 http://localhost:3000

## Railway 部署

1. 在 Railway 创建 MySQL 服务
2. 部署此项目
3. Railway 注入 `MYSQLHOST`, `MYSQLPORT`, `MYSQLUSER`, `MYSQLPASSWORD`, `MYSQLDATABASE`
4. 在服务变量里添加 `ACCESS_PASSWORD`
5. 在 Railway MySQL 控制台执行 `sql/init.sql`

`sql/init.sql` 不会创建/切换数据库，也不会删除已有表。

## Excel 格式

仅支持 `.xlsx` 文件。列名支持中英文：国家/country、地区/region、号码/number。

## 测试

```bash
npm test
```
