const express = require('express');
const router = express.Router();
const sql = require('mssql');
const dotenv = require('dotenv');
const jwt = require('jsonwebtoken');
const checkAuth = require('../../middleware/auth-check');
const bcrypt = require('bcryptjs');
dotenv.config();
const {
  wrapError,
  DBError,
  UniqueViolationError,
  NotNullViolationError 
} = require('db-errors');

// GET ALL STUDENTS
router.get('/', checkAuth, (req, res) => {
  (async function(){
    try {
      const sqlReq = new sql.Request();
      const sqlQuery = 'SELECT ID, Name, Email, Study, IndexNumber FROM Students';
      const result = await sqlReq.query(sqlQuery);
      res.status(200).json(result.recordset);
    } catch (error) {
      handleError(error, res);
    }
  })()
})

// GET SINGLE STUDENT BY ID
router.get('/single/:id', checkAuth, (req, res) => {
  (async function(){
    try {
      const sqlReq = new sql.Request();
      sqlReq.input('id', req.params.id);
      const sqlQuery = `SELECT 
        s.ID AS ID, 
        s.Name AS Name, 
        s.Email AS Email, 
        s.Study AS Study, 
        s.IndexNumber AS IndexNumber,
        c.Name as 'ClassName',
        c.Code AS 'ClassCode',
        t.Name AS 'TeacherName',
        t.TeacherId AS 'TeacherId',
        t.Active AS 'Active'
        FROM Students as s
          left join StudentClasses as sc on (sc.StudentId = s.ID)
          left join Classes as c on (c.Code = sc.ClassCode)
          left join TeacherClasses as tc on (tc.ClassCode = sc.ClassCode)
          left join Teachers as t on (t.TeacherId = tc.TeacherId)
        WHERE
          s.ID = @id
      `;
      const result = await sqlReq.query(sqlQuery);
      const responseBody = result.recordset[0];
      responseBody.Classes = [];
      result.recordset.forEach(e => {
        if(e.ClassCode) {
          const tempClass = {
            Code: e.ClassCode,
            Name: e.ClassName,
            Teacher: {
              TeacherId: e.TeacherId,
              Name: e.TeacherName,
              Active: e.Active
            }
          }
          responseBody.Classes.push(tempClass);
        }
      });
      delete responseBody.Active;
      delete responseBody.ClassName;
      delete responseBody.ClassCode;
      delete responseBody.TeacherName;
      delete responseBody.TeacherId;
      res.status(200).json(responseBody);
    } catch (error) {
      console.log(error);
      handleError(error, res);
    }
  })()
});

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
        t.TeacherId AS 'TeacherId',
        t.Active AS 'Active'
      FROM Students as s
        inner join StudentClasses as sc on (sc.StudentId = s.ID)
        inner join Classes as c on (c.Code = sc.ClassCode)
        inner join TeacherClasses as tc on (tc.ClassCode = sc.ClassCode)
        inner join Teachers as t on (t.TeacherId = tc.TeacherId)
      WHERE
        s.ID = @userId
      `;
      const result = await sqlRequest.query(sqlQuery);
      const responseBody = [];
      result.recordset.forEach( r => {
        r.Teacher = {};
        r.Teacher.Name = r.TeacherName;
        r.Teacher.TeacherId = r.TeacherId;
        r.Teacher.Active = r.Active;
        delete r.TeacherName;
        delete r.TeacherId;
        delete r.Active;
        responseBody.push(r);
      });
      res.status(200).json(responseBody);
    } catch (error) {
      handleError(error, res);
    }
  })()
});

router.get('/classes/available/:studentID', checkAuth, (req, res) => {
  (async function(){
    try {
      const sqlRequest = new sql.Request();
      sqlRequest.input('userId', req.params.studentID);
      const sqlQuery = `
        SELECT 
          c.Name,
          c.Code,
          t.TeacherId,
          t.Name AS 'TeacherName',
          t.Active AS 'Active'
        FROM Classes as c
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
      const responseBody = [];
      result.recordset.forEach( r => {
        r.Teacher = {};
        r.Teacher.Name = r.TeacherName;
        r.Teacher.TeacherId = r.TeacherId;
        r.Teacher.Active = r.Active;
        delete r.TeacherName;
        delete r.TeacherId;
        delete r.Active;
        responseBody.push(r);
      });
      res.status(200).json(responseBody);
    } catch (error) {
      handleError(error, res);
    }
  })()
});

router.post('/assign/classes', checkAuth, (req, res) => {
  (async function(){
    try {
      const deleteSqlRequest = new sql.Request();
      deleteSqlRequest.input('studentId', req.body.userID);
      const deleteQuery = `
        DELETE FROM StudentClasses
        WHERE StudentId = @studentId
      `;
      await deleteSqlRequest.query(deleteQuery);
      if(req.body.classes.length){
        const sqlRequest = new sql.Request();
        sqlRequest.input('studentId', req.body.userID);
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
        await sqlRequest.query(sqlQuery);
      }
      res.status(201).json({message: 'Success'});
    } catch (error) {
      handleError(error, res);
    }
  })()
});

router.put('/', checkAuth, (req, res) => {
  (async function(){
    try {
      const sqlRequest = new sql.Request();
      sqlRequest.input('id', req.body.ID);
      sqlRequest.input('name', req.body.Name);
      sqlRequest.input('email', req.body.Email);
      sqlRequest.input('index', req.body.IndexNumber);
      sqlRequest.input('study', req.body.Study);
      const sqlQuery = `UPDATE Students SET Name=@name, Email=@email, IndexNumber=@index, Study=@study
      WHERE ID = @id`;
      await sqlRequest.query(sqlQuery);
      res.status(200).json({message: 'Success'});
    } catch (error) {
      handleError(error, res);
    }
  })()
});

router.put('/password', checkAuth, (req, res) => {
  (async function(){
    try {
      const sqlRequest = new sql.Request();
      sqlRequest.input('id', req.body.ID);
      sqlRequest.input('password', await bcrypt.hash(req.body.Password, 10));
      const sqlQuery = `UPDATE Students SET Password=@password WHERE ID = @id`;
      await sqlRequest.query(sqlQuery);
      res.status(200).json({message: 'Success'});
    } catch (error) {
      console.log(error);
      handleError(error, res);
    }
  })()
});

router.delete('/:id', checkAuth, (req,res) => {
  (async function(){
    try {
      const sqlRequest = new sql.Request();
      sqlRequest.input('id', req.params.id);
      const sqlQuery = 'DELETE FROM Students WHERE ID = @id';
      await sqlRequest.query(sqlQuery);
      res.status(200).json({message: 'Success'});
    } catch (error) {
      handleError(error, res);
    }
  })()
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