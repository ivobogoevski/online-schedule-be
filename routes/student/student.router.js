const express = require('express');
const router = express.Router();
const sql = require('mssql');
const dotenv = require('dotenv');
const jwt = require('jsonwebtoken');
const checkAuth = require('../../middleware/auth-check');
dotenv.config();

router.get('/classes', checkAuth, (req, res) => {
  (async function(){
    try {
      const userId = jwt.verify(req.headers.authorization, process.env.SECRET_KEY).UserID;
      const sqlRequest = new sql.Request();
      sqlRequest.input('userId', userId);
      const sqlQuery = `
      SELECT
        c.Name as 'Name',
        c.Code AS 'Code',
        c.Classroom AS 'Classroom',
        c.ClassDate AS 'ClassDate',
        c.ExerciseRoom AS 'ExerciseRoom',
        c.ExerciseDate AS 'ExerciseDate',
        t.Name AS 'TeacherName',
        t.TeacherId AS 'TeacherId'
      FROM Students as s
        inner join StudentClasses as sc on (sc.StudentId = s.ID)
        inner join Classes as c on (c.Code = sc.ClassCode)
        inner join TeacherClasses as tc on (tc.ClassCode = sc.ClassCode)
        inner join Teachers as t on (t.TeacherId = tc.TeacherId)
      WHERE
        s.ID = @userId
      `;

      const result = await sqlRequest.query(sqlQuery);
      const response = [];
      result.recordset.forEach( r => {
        r.Teacher = {};
        r.Teacher.Name = r.TeacherName;
        r.Teacher.TeacherId = r.TeacherId;
        delete r.TeacherName;
        delete r.TeacherId;
        response.push(r);
      });
      res.status(200).json(response);
    } catch (error) {
      res.status(500).json(error);
    }
  })()
});

router.get('/classes/available', checkAuth, (req, res) => {
  (async function(){
    try {
      const userId = jwt.verify(req.headers.authorization, process.env.SECRET_KEY).UserID;
      const sqlRequest = new sql.Request();
      sqlRequest.input('userId', userId);
      const sqlQuery = `
        SELECT 
          c.Name,
          c.Code,
          t.TeacherId,
          t.Name AS 'TeacherName'
        FROM Classes c
          inner join TeacherClasses as tc on (tc.ClassCode = c.Code)
          inner join Teachers as t on (t.TeacherId = tc.TeacherId)
        WHERE c.Code not in (
          SELECT c.Code
          FROM Classes c
            inner join StudentClasses sc on c.Code = sc.ClassCode
            inner join Students s on s.ID = sc.StudentId
          WHERE s.ID = @userId
        )
      `;

      const result = await sqlRequest.query(sqlQuery);
      const response = [];
      result.recordset.forEach( r => {
        r.Teacher = {};
        r.Teacher.Name = r.TeacherName;
        r.Teacher.TeacherId = r.TeacherId;
        delete r.TeacherName;
        delete r.TeacherId;
        response.push(r);
      });
      res.status(200).json(response);
    } catch (error) {
      res.status(500).json(error);
    }
  })()
});

router.post('/assign/classes', checkAuth, (req, res) => {
  (async function(){
    try {
      const userId = jwt.verify(req.headers.authorization, process.env.SECRET_KEY).UserID;
      const deleteSqlRequest = new sql.Request();
      deleteSqlRequest.input('studentId', userId);
      const deleteQuery = `
        DELETE FROM StudentClasses
        WHERE StudentId = @studentId
      `;
      await deleteSqlRequest.query(deleteQuery);
      const sqlRequest = new sql.Request();
      sqlRequest.input('studentId', userId);
      let sqlQuery = `
        INSERT INTO StudentClasses (ClassCode, StudentId)
        VALUES
      `;
      req.body.classes.forEach( (e, index) => {
        sqlRequest.input(`classCode${index}`, e.Code);
        sqlQuery = sqlQuery + `(@classCode${index}, @studentId)`;
        if(index < req.body.classes.length - 1){
          sqlQuery = sqlQuery + `,
          `;
        }
      });
      const result = await sqlRequest.query(sqlQuery);
      res.status(201).json(result);
    } catch (error) {
      res.status(500).json(error.originalError.info.message);
    }
  })()
});



module.exports = router;