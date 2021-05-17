const express = require('express');
const router = express.Router();
const sql = require('mssql');
const authCheck = require('../../middleware/auth-check');
const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');
dotenv.config();
const {
  wrapError,
  DBError,
  UniqueViolationError,
  NotNullViolationError 
} = require('db-errors');

router.get('/', authCheck, (req,res) => {
  (async function(){
    try {
      const decodedToken = jwt.verify(req.headers.authorization, process.env.SECRET_KEY);
      const sqlReq = new sql.Request();
      sqlReq.input('userId', decodedToken.UserID);
      const sqlQuery = `SELECT
      c.Name as 'Name',
      c.Code AS 'Code',
      t.Name AS 'TeacherName',
      t.TeacherId AS 'TeacherId',
      t.Active AS 'Active',
      e.ExamType AS 'ExamType',
      e.ExamDate as 'Date',
      e.Classroom as 'Classroom'
    FROM Students as s
      inner join StudentClasses as sc on (sc.StudentId = s.ID)
      inner join Classes as c on (c.Code = sc.ClassCode)
      inner join Exams as e on (e.ClassCode = sc.ClassCode)
      inner join TeacherClasses as tc on (tc.ClassCode = sc.ClassCode)
      inner join Teachers as t on (t.TeacherId = tc.TeacherId)
    WHERE
      s.ID = @userId`;
    
    const result = await sqlReq.query(sqlQuery);
    const responseBody = [];
    const todayDate = new Date().valueOf();
    result.recordset.forEach( r => {
      if(r.Date >= todayDate && r.Active) {
        r.Teacher = {};
        r.Teacher.Name = r.TeacherName;
        r.Teacher.TeacherId = r.TeacherId;
        r.Exam = {};
        r.Exam.Classroom = r.Classroom;
        r.Exam.ExamDate = r.Date;
        r.Exam.ExamType = r.ExamType;
        delete r.TeacherName;
        delete r.TeacherId;
        delete r.Classroom;
        delete r.Date;
        delete r.ExamType;
        responseBody.push(r);
      }
    });
    res.status(200).json(responseBody);
    } catch (error) {
      handleError(error, res);
    }
  })();
});

router.get('/class/:code', authCheck, (req,res) => {
  (async function(){
    try {
      const sqlReq = new sql.Request();
      sqlReq.input('classCode', req.params.code);
    
      const sqlQuery = 'SELECT * FROM Exams WHERE ClassCode = @classCode';
      const result = await sqlReq.query(sqlQuery);
      res.status(200).json(result.recordset);
    } catch (error) {
      handleError(error, res);
    }
  })();
});

router.post('/', authCheck, (req,res) => {
  (async function(){
    try {
      const sqlReq = new sql.Request();
      sqlReq.input('ExamDate', req.body.ExamDate);
      sqlReq.input('Classroom', req.body.Classroom);
      sqlReq.input('ExamType', req.body.ExamType);
      sqlReq.input('ClassCode', req.body.ClassCode);
    
      const sqlQuery = `INSERT INTO Exams (ExamDate, Classroom, ExamType, ClassCode) 
      VALUES (@ExamDate, @Classroom, @ExamType, @ClassCode)`;
      const result = await sqlReq.query(sqlQuery);
      res.status(200).json({message: 'Success'});
    } catch (error) {
      console.log(error);
      handleError(error, res);
    }
  })();
});

router.put('/', authCheck, (req,res) => {
  (async function(){
    try {
      const sqlReq = new sql.Request();
      sqlReq.input('ExamDate', req.body.ExamDate);
      sqlReq.input('Classroom', req.body.Classroom);
      sqlReq.input('ExamID', req.body.ExamID);
    
      const sqlQuery = `UPDATE Exams 
      SET ExamDate = @ExamDate, Classroom = @Classroom 
      WHERE ExamID = @ExamID`;
      const result = await sqlReq.query(sqlQuery);
      res.status(200).json({message: 'Success'});
    } catch (error) {
      console.log(error);
      handleError(error, res);
    }
  })();
});

router.delete('/:examID', authCheck, (req,res) => {
  (async function(){
    try {
      const sqlReq = new sql.Request();
      sqlReq.input('ExamID', req.params.examID);
    
      const sqlQuery = `DELETE FROM Exams 
      WHERE ExamID = @ExamID`;
      const result = await sqlReq.query(sqlQuery);
      res.status(200).json({message: 'Success'});
    } catch (error) {
      console.log(error);
      handleError(error, res);
    }
  })();
});

function handleError(error, res) {
  err = wrapError(error);
  if (err instanceof UniqueViolationError) {
    res.status(500).json({message: `${err.column} already exists.`});
  } else if (err instanceof NotNullViolationError) {
    res.status(500).json({message: `${err.column} is required.`});
  } else {
    res.status(500).json({message: 'Sorry, some unknown error occurred. Please try again.'});
  }
}

module.exports = router;