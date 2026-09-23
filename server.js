const express = require('express');
const mysql = require('mysql2/promise');
const multer = require('multer');
const ExcelJS = require('exceljs');
const path = require('path');
const fs = require('fs/promises');

const app = express();
const PORT = process.env.PORT || 3000;
const ACCESS_PASSWORD = process.env.ACCESS_PASSWORD || '';

// MySQL connection pool compatible with Railway variables.
const pool = mysql.createPool({
  host: process.env.MYSQLHOST || process.env.MYSQL_HOST || 'localhost',
  port: process.env.MYSQLPORT || process.env.MYSQL_PORT || 3306,
  user: process.env.MYSQLUSER || process.env.MYSQL_USER || 'root',
  password: process.env.MYSQLPASSWORD || process.env.MYSQL_PASSWORD || '',
  database: process.env.MYSQLDATABASE || process.env.MYSQL_DATABASE || 'phone_manager',
  waitForConnections: true,
  connectionLimit: 10,
});

const upload = multer({
  dest: 'uploads/',
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext === '.xlsx') {
      cb(null, true);
    } else {
      cb(new Error('仅支持 .xlsx 文件'));
    }
  },
  limits: { fileSize: 10 * 1024 * 1024 },
});

app.use(express.json());
app.use(requireAccessPassword);
app.use(express.static('public'));

function requireAccessPassword(req, res, next) {
  if (!ACCESS_PASSWORD || !req.path.startsWith('/api/')) {
    return next();
  }

  const password = req.get('x-access-password') || '';
  if (password === ACCESS_PASSWORD) {
    return next();
  }

  res.status(401).json({ code: 1, message: '访问密码错误' });
}

app.get('/api/numbers', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.pageSize) || 10;
    const keyword = (req.query.keyword || '').trim();
    const status = req.query.status || 'all';
    const offset = (page - 1) * pageSize;

    const where = [];
    const params = [];

    if (keyword) {
      where.push('(country LIKE ? OR region LIKE ? OR number LIKE ?)');
      const kw = `%${keyword}%`;
      params.push(kw, kw, kw);
    }
    if (status && status !== 'all') {
      where.push('status = ?');
      params.push(status);
    }

    const whereClause = where.length > 0 ? 'WHERE ' + where.join(' AND ') : '';

    const [rows] = await pool.query(
      `SELECT id, country, region, number, status,
              IFNULL(DATE_FORMAT(used_time, '%Y-%m-%d %H:%i'), '-') AS used_time
       FROM phone_numbers ${whereClause}
       ORDER BY id ASC
       LIMIT ? OFFSET ?`,
      [...params, pageSize, offset]
    );

    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total FROM phone_numbers ${whereClause}`,
      params
    );

    const [[{ unused }]] = await pool.query(
      `SELECT COUNT(*) AS unused FROM phone_numbers WHERE status = '未使用'`
    );
    const [[{ used }]] = await pool.query(
      `SELECT COUNT(*) AS used FROM phone_numbers WHERE status = '已使用'`
    );

    res.json({
      code: 0,
      data: {
        list: rows,
        total,
        unused,
        used,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ code: 1, message: err.message });
  }
});

app.put('/api/numbers/:id/use', async (req, res) => {
  try {
    const [result] = await pool.query(
      'UPDATE phone_numbers SET status = \'已使用\', used_time = NOW() WHERE id = ?',
      [req.params.id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ code: 1, message: '号码不存在' });
    }
    res.json({ code: 0, message: '已标记为已使用' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ code: 1, message: err.message });
  }
});

app.post('/api/numbers/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ code: 1, message: '请选择文件' });
    }

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(req.file.path);
    const sheet = workbook.worksheets[0];
    const data = sheet ? sheetToRows(sheet) : [];

    if (data.length === 0) {
      return res.status(400).json({ code: 1, message: 'Excel 无数据' });
    }

    let inserted = 0;
    let skipped = 0;

    for (const row of data) {
      const country = (row['国家'] || row.country || '').toString().trim();
      const region = (row['地区'] || row.region || '').toString().trim();
      const number = (row['号码'] || row.number || '').toString().trim();

      if (!number) {
        skipped++;
        continue;
      }

      try {
        await pool.query(
          'INSERT INTO phone_numbers (country, region, number, status) VALUES (?, ?, ?, ?)',
          [country, region, number, '未使用']
        );
        inserted++;
      } catch (e) {
        if (e.code === 'ER_DUP_ENTRY') {
          skipped++;
        } else {
          throw e;
        }
      }
    }

    res.json({
      code: 0,
      message: `导入完成：新增 ${inserted} 条，跳过 ${skipped} 条`,
      inserted,
      skipped,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ code: 1, message: err.message });
  } finally {
    if (req.file) {
      await fs.unlink(req.file.path).catch(() => {});
    }
  }
});

function sheetToRows(sheet) {
  const headerRow = sheet.getRow(1);
  const headers = {};

  headerRow.eachCell((cell, colNumber) => {
    const key = String(cell.value || '').trim().toLowerCase();
    if (key) {
      headers[key] = colNumber;
    }
  });

  const rows = [];
  for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber++) {
    const row = sheet.getRow(rowNumber);
    rows.push({
      '国家': getCellText(row, headers['国家'] || headers.country),
      country: getCellText(row, headers.country || headers['国家']),
      '地区': getCellText(row, headers['地区'] || headers.region),
      region: getCellText(row, headers.region || headers['地区']),
      '号码': getCellText(row, headers['号码'] || headers.number),
      number: getCellText(row, headers.number || headers['号码']),
    });
  }

  return rows;
}

function getCellText(row, colNumber) {
  if (!colNumber) return '';
  const value = row.getCell(colNumber).value;
  if (value == null) return '';
  if (typeof value === 'object' && value.text) return value.text;
  if (typeof value === 'object' && value.result != null) return String(value.result);
  return String(value);
}

app.listen(PORT, () => {
  console.log(`电话号码管理系统已启动 -> http://localhost:${PORT}`);
});
