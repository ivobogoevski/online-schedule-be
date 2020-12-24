const express = require('express');
const router = express.Router();
const checkAuth = require('../../middleware/auth-check');
const sql = require('mssql');
const authCheck = require('../../middleware/auth-check');
const jwt = require('jsonwebtoken');

router.get('/', authCheck, (req, res) =>{
  (async function(){
    try {
      const sqlRequest = new sql.Request();
      const sqlQuery = `
        SELECT * FROM Classes;
      `;
      const result = await sqlRequest.query(sqlQuery);
      res.status(200).json(result.recordset);
    } catch (error) {
      res.status(500).json(error.originalError.info.message);
    }
  })()
});

router.post('/', checkAuth, (req,res) => {
  (async function(){
    try {
      const sqlRequest = new sql.Request();
      sqlRequest.input('code', req.body.Code);
      sqlRequest.input('name', req.body.Name);
      sqlRequest.input('study', req.body.Study);
      sqlRequest.input('semester', req.body.Semester);
      sqlRequest.input('classroom', req.body.Classroom);
      sqlRequest.input('classDate', req.body.ClassDate);
      sqlRequest.input('exerciseDate', req.body.ExerciseDate);
      sqlRequest.input('exerciseRoom', req.body.ExerciseRoom);
      const sqlQuery = `
        INSERT INTO Classes (Code, Name, Study, Semester, Classroom, ClassDate, ExerciseRoom, ExerciseDate)
        VALUES (@code, @name, @study, @semester, @classroom, @classDate, @exerciseRoom, @exerciseDate)
      `;
      const result = await sqlRequest.query(sqlQuery);
      res.status(201).json(result);
    } catch (error) {
      res.status(500).json(error.originalError.info.message);
    }
  })()
});

module.exports = router;