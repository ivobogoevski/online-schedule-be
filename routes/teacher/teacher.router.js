const express = require('express');
const router = express.Router();
const sql = require('mssql');
const authCheck = require('../../middleware/auth-check');
const bcrypt = require('bcryptjs')

router.post('/', authCheck, (req, res) => {
  (async function(){
    try {
      const cryptedPassword = await bcrypt.hash(req.body.Password, 10);
      const sqlRequest = new sql.Request();
      sqlRequest.input('name', req.body.Name);
      sqlRequest.input('email', req.body.Email);
      sqlRequest.input('office', req.body.Office);
      sqlRequest.input('pass', cryptedPassword);
      const sqlQuery = `
        INSERT INTO Teachers (Name, Email, Office, Password)
        VALUES (@name, @email, @office, @pass)
      `;
      const result = await sqlRequest.query(sqlQuery);
      res.status(201).json(result);
    } catch (error) {
      handleError(error, res);
    }
  })()
});

router.post('/assign/class', authCheck, (req, res) => {
  (async function(){
    try {
      const sqlRequest = new sql.Request();
      sqlRequest.input('classCode', req.body.ClassCode);
      sqlRequest.input('teacherId', req.body.TeacherId);
      const sqlQuery = `
        INSERT INTO TeacherClasses (ClassCode, TeacherId)
        VALUES (@classCode, @teacherId)
      `;
      const result = await sqlRequest.query(sqlQuery);
      res.status(201).json(result);
    } catch (error) {
      handleError(error, res);
    }
  })()
});

function handleError(e, res){
  res.status(500).json(e.originalError.info.message);
}

module.exports = router;