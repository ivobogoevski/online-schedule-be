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
    const response = [];
    result.recordset.forEach( r => {
      r.Teacher = {};
      r.Teacher.Name = r.TeacherName;
      r.Teacher.TeacherId = r.TeacherId;
      r.Exam = {};
      r.Exam.Classroom = r.Classroom;
      r.Exam.Date = r.Date;
      r.Exam.Type = r.ExamType;
      delete r.TeacherName;
      delete r.TeacherId;
      delete r.Classroom;
      delete r.Date;
      delete r.ExamType;
      response.push(r);
    });
    res.status(200).json(response);
    } catch (error) {
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