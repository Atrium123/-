const express = require('express');
const session = require('express-session');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const mongoose = require('mongoose');
const { MongoClient } = require('mongodb');

const sessionTimeout = 300000; //记得还回来记得改回来记得改回来

//检查会话是否超时
function checkSessionTimeout(req, res, next) {
  const currentTime = Date.now();
  const loginTime = req.session.loginTime; 

  
  if (!loginTime || (currentTime - loginTime > sessionTimeout)) {
    const timeoutMessage = 'Session expired. Please login again.';

    
    req.session.message = timeoutMessage;

    req.session.destroy(() => {
      
      req.session = null; 
      res.redirect('/login'); 
    });
    return;
  }

  next(); 
}



// 连接到 MongoDB
mongoose.connect('mongodb://mongodb/Gradebook')
  .then(() => {
    console.log("Connected to MongoDB");
  })
  .catch(err => {
    console.log("MongoDB connection error: " + err);
  });

const app = express();


app.use(express.static('static'));


app.set('view engine', 'pug');
app.set('views', 'views');


app.use(express.urlencoded({ extended: false }));

app.use(session({
  secret: 'your_secret_key', 
  resave: false,
  saveUninitialized: true,
}));


const userSchema = new mongoose.Schema({
  _id: Number,
  uid: Number,
  email: { type: String, required: true },
  secret: String,
  timestamp: String,
});


const User = mongoose.model('User', userSchema);

const courseinfoSchema = new mongoose.Schema({
  _id: Number,
  uid: Number, 
  course: String, 
  assign: String, 
  score: Number, 
});


const Courseinfo = mongoose.model('Courseinfo', courseinfoSchema, 'courseinfo');



const transporter = nodemailer.createTransport({
  host: 'testmail.cs.hku.hk',
  port: 25,
  secure: false, 
});

app.get('/login', async (req, res) => {
  const { token } = req.query; 

  const message = req.session ? req.session.message : ''; 
  req.session && (req.session.message = null); 

  if (!token) {
    return res.render('login', { message });
  }

  try {
    const decoded = Buffer.from(token, 'base64').toString('utf-8');
    const { uid, secret, timestamp } = JSON.parse(decoded);

    const currentTimestamp = Date.now();
    const tokenAge = currentTimestamp - timestamp;

    if (tokenAge > 60000) {
      return res.render('login', { message: 'Fail to authenticate - OTP expired!' });
    }

    const user = await User.findOne({ uid });
    if (!user || user.secret !== secret) {
      return res.render('login', { message: 'Fail to authenticate - incorrect secret!' });
    }

    
    req.session.uid = uid;
    req.session.loginTime = Date.now(); 
    console.log('Session started at:', req.session.loginTime);

    res.redirect('/courseinfo/mylist');
  } catch (err) {
    console.error('Error during token validation:', err);
    res.status(500).send('Internal Server Error');
  }
});



// 处理 /login 的 POST 请求
app.post('/login', async (req, res) => {
  const { email } = req.body;

  try {
    const user = await User.findOne({ email });
    if (user) {
      const secret = crypto.randomBytes(16).toString('base64');
      const timestamp = Date.now();
      const token = Buffer.from(JSON.stringify({ uid: user.uid, secret: secret, timestamp: timestamp })).toString('base64');
      user.secret = secret;
      user.timestamp = timestamp;
      await user.save();
      const mailOptions = {
        from: 'u3626519@connect.hku.hk',
        to: email,
        subject: 'Your Access Token',
        html: ` <p>Dear Student,</p>
                <p>You can log on to the system via the following link:</p>
                <p><a href="http://localhost:8080/login?token=${token}">http://localhost:8080/login?token=${token}</a></p>`,
      };
      await transporter.sendMail(mailOptions);

      res.render('login', { message: 'Please check your email to get the URL for accessing the course info page.' });
    } else {
      res.render('login', { message: `Unknown user - we don't have the record for ${email} in the system` });
    }
  } catch (err) {
    console.error(err);
    res.status(500).send('Internal server error');
  }
});

// 检查会话是否超时
app.get('/courseinfo/mylist', checkSessionTimeout, async (req, res) => {
  const { uid } = req.session;

  if (!uid) {
    return res.status(400).send('User not authenticated');
  }

  try {
    const courses = await Courseinfo.find({ uid }).exec();
    const courseLinks = courses.length
      ? [...new Set(courses.map(course => course.course))].map(courseName => ({
        name: courseName,
        link: `/courseinfo/getscore?course=${courseName}`,
      }))
      : [];

    res.render('courseinfo', {
      title: 'Course Information',
      message: `Retrieve continuous assessment scores for: ${uid}`,
      courses: courseLinks,
    });
  } catch (err) {
    console.error('Error during course query:', err);
    res.status(500).send('Internal Server Error');
  }
});

app.get('/courseinfo/getscore', checkSessionTimeout, async (req, res) => {
  const { course } = req.query;
  const { uid } = req.session;

  if (!uid || !course) {
    return res.status(400).send('Missing UID or course information');
  }

  try {
    const courseData = await Courseinfo.find({ uid, course }).exec();
    const totalScore = courseData.reduce((sum, item) => sum + item.score, 0);

    if (courseData.length === 0) {
      return res.render('getscore', {
        title: 'Course Information',
        message: `${course} - Gradebook`,
        courseName: course,
        rows: [],
        totalScore: 0,
        noGradebook: true,
      });
    }

    res.render('getscore', {
      title: 'Course Information',
      message: `${course} - Gradebook`,
      courseName: course,
      rows: courseData,
      totalScore,
      noGradebook: false,
    });
  } catch (err) {
    console.error('Error querying course data:', err);
    res.status(500).send('Internal Server Error');
  }
});





const port = 8080;
app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});
