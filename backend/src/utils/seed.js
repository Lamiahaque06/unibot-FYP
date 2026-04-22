require('dotenv').config();
const connectDB = require('../config/database');
const { User, Course, Enrollment, Fee, FAQ, Document } = require('../models');
const logger = require('./logger');

/**
 * Database Seeding Script
 * Populates the database with dummy data for development and testing
 */

const seedDatabase = async () => {
  try {
    logger.info('Starting database seeding...');

    // Connect to database
    await connectDB();

    // Clear existing data
    logger.info('Clearing existing data...');
    await User.deleteMany({});
    await Course.deleteMany({});
    await Enrollment.deleteMany({});
    await Fee.deleteMany({});
    await FAQ.deleteMany({});
    await Document.deleteMany({});

    // Create Admin User
    logger.info('Creating admin user...');
    const admin = await User.create({
      email: 'admin@college.edu',
      password: 'admin123',
      role: 'admin',
      profile: {
        firstName: 'Admin',
        lastName: 'User',
      },
    });

    // Create Student Users
    logger.info('Creating student users...');
    const students = await User.create([
      {
        email: 'john.doe@student.edu',
        password: 'student123',
        role: 'student',
        profile: {
          firstName: 'John',
          lastName: 'Doe',
          studentId: 'W1234567',
          major: 'Computer Science',
          enrollmentYear: 2023,
          semester: 3,
          phoneNumber: '+1234567890',
        },
      },
      {
        email: 'jane.smith@student.edu',
        password: 'student123',
        role: 'student',
        profile: {
          firstName: 'Jane',
          lastName: 'Smith',
          studentId: 'W1234568',
          major: 'Business Administration',
          enrollmentYear: 2024,
          semester: 1,
          phoneNumber: '+1234567891',
        },
      },
      {
        email: 'bob.johnson@student.edu',
        password: 'student123',
        role: 'student',
        profile: {
          firstName: 'Bob',
          lastName: 'Johnson',
          studentId: 'W1234569',
          major: 'Computer Science',
          enrollmentYear: 2023,
          semester: 3,
          phoneNumber: '+1234567892',
        },
      },
    ]);

    // Create Courses
    logger.info('Creating courses...');
    const courses = await Course.create([
      {
        courseCode: 'CS101',
        courseName: 'Introduction to Programming',
        description: 'Learn the fundamentals of programming using Python. Covers variables, data types, control structures, functions, and basic algorithms.',
        credits: 4,
        department: 'Computer Science',
        level: 'undergraduate',
        semester: 'Fall',
        year: 2025,
        instructor: {
          name: 'Dr. Sarah Williams',
          email: 'sarah.williams@college.edu',
          officeHours: 'Mon & Wed 2-4 PM',
          officeLocation: 'CS Building Room 305',
        },
        schedule: [
          { day: 'Monday', startTime: '10:00 AM', endTime: '11:30 AM', location: 'CS Lab 1' },
          { day: 'Wednesday', startTime: '10:00 AM', endTime: '11:30 AM', location: 'CS Lab 1' },
        ],
        maxEnrollment: 30,
        currentEnrollment: 2,
        status: 'active',
      },
      {
        courseCode: 'CS201',
        courseName: 'Data Structures and Algorithms',
        description: 'Advanced course covering arrays, linked lists, stacks, queues, trees, graphs, sorting, and searching algorithms.',
        credits: 4,
        department: 'Computer Science',
        level: 'undergraduate',
        semester: 'Fall',
        year: 2025,
        instructor: {
          name: 'Prof. Michael Chen',
          email: 'michael.chen@college.edu',
          officeHours: 'Tue & Thu 3-5 PM',
          officeLocation: 'CS Building Room 310',
        },
        schedule: [
          { day: 'Tuesday', startTime: '1:00 PM', endTime: '2:30 PM', location: 'CS Lab 2' },
          { day: 'Thursday', startTime: '1:00 PM', endTime: '2:30 PM', location: 'CS Lab 2' },
        ],
        prerequisites: ['CS101'],
        maxEnrollment: 25,
        currentEnrollment: 1,
        status: 'active',
      },
      {
        courseCode: 'BUS101',
        courseName: 'Business Fundamentals',
        description: 'Introduction to business concepts including management, marketing, finance, and organizational behavior.',
        credits: 3,
        department: 'Business',
        level: 'undergraduate',
        semester: 'Fall',
        year: 2025,
        instructor: {
          name: 'Dr. Emily Johnson',
          email: 'emily.johnson@college.edu',
          officeHours: 'Mon & Fri 10-12 PM',
          officeLocation: 'Business Building Room 201',
        },
        schedule: [
          { day: 'Monday', startTime: '2:00 PM', endTime: '3:30 PM', location: 'Lecture Hall A' },
          { day: 'Friday', startTime: '2:00 PM', endTime: '3:30 PM', location: 'Lecture Hall A' },
        ],
        maxEnrollment: 40,
        currentEnrollment: 1,
        status: 'active',
      },
      {
        courseCode: 'MATH201',
        courseName: 'Calculus II',
        description: 'Advanced calculus covering integration techniques, sequences, series, and multivariable calculus.',
        credits: 4,
        department: 'Mathematics',
        level: 'undergraduate',
        semester: 'Fall',
        year: 2025,
        instructor: {
          name: 'Prof. David Martinez',
          email: 'david.martinez@college.edu',
          officeHours: 'Wed 1-3 PM',
          officeLocation: 'Math Building Room 105',
        },
        schedule: [
          { day: 'Monday', startTime: '9:00 AM', endTime: '10:00 AM', location: 'Math 101' },
          { day: 'Wednesday', startTime: '9:00 AM', endTime: '10:00 AM', location: 'Math 101' },
          { day: 'Friday', startTime: '9:00 AM', endTime: '10:00 AM', location: 'Math 101' },
        ],
        prerequisites: ['MATH101'],
        maxEnrollment: 35,
        currentEnrollment: 0,
        status: 'active',
      },
    ]);

    // Create Enrollments
    logger.info('Creating enrollments...');
    const enrollments = await Enrollment.create([
      {
        student: students[0]._id,
        course: courses[0]._id,
        semester: 'Fall',
        year: 2025,
        status: 'enrolled',
        assignments: [
          {
            title: 'Assignment 1: Variables and Data Types',
            dueDate: new Date('2025-11-15'),
            submitted: true,
            score: 95,
            maxScore: 100,
          },
          {
            title: 'Assignment 2: Control Structures',
            dueDate: new Date('2025-11-30'),
            submitted: false,
          },
        ],
        exams: [
          {
            title: 'Midterm Exam',
            date: new Date('2025-12-10'),
            type: 'midterm',
          },
        ],
        attendance: {
          totalClasses: 20,
          attendedClasses: 18,
        },
      },
      {
        student: students[0]._id,
        course: courses[1]._id,
        semester: 'Fall',
        year: 2025,
        status: 'enrolled',
        assignments: [
          {
            title: 'Lab 1: Arrays',
            dueDate: new Date('2025-11-20'),
            submitted: true,
            score: 88,
            maxScore: 100,
          },
        ],
        exams: [
          {
            title: 'Quiz 1',
            date: new Date('2025-11-25'),
            type: 'quiz',
          },
        ],
        attendance: {
          totalClasses: 18,
          attendedClasses: 17,
        },
      },
      {
        student: students[1]._id,
        course: courses[2]._id,
        semester: 'Fall',
        year: 2025,
        status: 'enrolled',
        assignments: [
          {
            title: 'Case Study 1',
            dueDate: new Date('2025-12-01'),
            submitted: false,
          },
        ],
        attendance: {
          totalClasses: 15,
          attendedClasses: 14,
        },
      },
      {
        student: students[2]._id,
        course: courses[0]._id,
        semester: 'Fall',
        year: 2025,
        status: 'enrolled',
        attendance: {
          totalClasses: 20,
          attendedClasses: 19,
        },
      },
    ]);

    // Create Fees
    logger.info('Creating fees...');
    await Fee.create([
      {
        student: students[0]._id,
        feeType: 'tuition',
        description: 'Fall 2025 Tuition Fee',
        amount: 5000,
        paidAmount: 5000,
        semester: 'Fall',
        year: 2025,
        dueDate: new Date('2025-09-01'),
        status: 'paid',
        payments: [
          {
            amount: 5000,
            paymentDate: new Date('2025-08-20'),
            paymentMethod: 'bank_transfer',
            transactionId: 'TXN123456',
          },
        ],
      },
      {
        student: students[0]._id,
        feeType: 'hostel',
        description: 'Hostel Fee - Fall 2025',
        amount: 1200,
        paidAmount: 600,
        semester: 'Fall',
        year: 2025,
        dueDate: new Date('2025-11-30'),
        status: 'partial',
        payments: [
          {
            amount: 600,
            paymentDate: new Date('2025-09-15'),
            paymentMethod: 'card',
            transactionId: 'TXN123457',
          },
        ],
      },
      {
        student: students[0]._id,
        feeType: 'library',
        description: 'Library Fee - Fall 2025',
        amount: 100,
        paidAmount: 0,
        semester: 'Fall',
        year: 2025,
        dueDate: new Date('2025-12-15'),
        status: 'pending',
      },
      {
        student: students[1]._id,
        feeType: 'tuition',
        description: 'Fall 2025 Tuition Fee',
        amount: 5000,
        paidAmount: 0,
        semester: 'Fall',
        year: 2025,
        dueDate: new Date('2025-10-01'),
        status: 'overdue',
        lateFee: 50,
      },
      {
        student: students[2]._id,
        feeType: 'tuition',
        description: 'Fall 2025 Tuition Fee',
        amount: 5000,
        paidAmount: 5000,
        semester: 'Fall',
        year: 2025,
        dueDate: new Date('2025-09-01'),
        status: 'paid',
      },
    ]);

    // Create FAQs
    logger.info('Creating FAQs...');
    await FAQ.create([
      {
        question: 'How do I apply for admission?',
        answer: 'To apply for admission, visit our online application portal at apply.college.edu. You will need to:\n\n1. Create an account\n2. Complete the application form\n3. Upload required documents (transcripts, test scores, ID)\n4. Pay the application fee ($50)\n5. Submit your application\n\nThe application deadline for Fall 2026 is May 1st, 2026. For Spring 2027, the deadline is November 1st, 2026.',
        category: 'admissions',
        keywords: ['admission', 'apply', 'application', 'enroll'],
        variations: [
          'How to apply?',
          'Application process',
          'How do I enroll?',
        ],
        priority: 10,
        status: 'active',
      },
      {
        question: 'What are the tuition fees?',
        answer: 'Tuition fees vary by program:\n\n- Undergraduate (per semester): $5,000\n- Graduate (per semester): $7,000\n\nAdditional fees:\n- Registration fee: $200\n- Library fee: $100 per semester\n- Laboratory fee (if applicable): $150 per course\n- Hostel fee: $1,200 per semester\n\nPayment plans are available. Contact the finance office for more information.',
        category: 'fees',
        keywords: ['tuition', 'fees', 'cost', 'price', 'payment'],
        variations: [
          'How much does it cost?',
          'What is the fee structure?',
          'Tuition cost',
        ],
        priority: 9,
        status: 'active',
      },
      {
        question: 'How do I apply for hostel accommodation?',
        answer: 'To apply for hostel accommodation:\n\n1. Log in to the student portal\n2. Navigate to "Hostel Application"\n3. Fill out the hostel preference form\n4. Submit required documents (ID, medical certificate)\n5. Pay the hostel application fee ($50)\n\nHostel allotment is done on a first-come-first-served basis. Priority is given to students from distant locations. The hostel fee is $1,200 per semester.',
        category: 'hostel',
        keywords: ['hostel', 'accommodation', 'dormitory', 'housing', 'residence'],
        variations: [
          'How to get hostel?',
          'Accommodation process',
          'Dorm application',
        ],
        priority: 8,
        status: 'active',
      },
      {
        question: 'When are the examination dates?',
        answer: 'Examination schedule for Fall 2025:\n\n- Midterm Exams: December 5-15, 2025\n- Final Exams: February 15-28, 2026\n\nThe detailed exam timetable will be published one month before the exam period. Students can view their personalized exam schedule on the student portal.',
        category: 'examinations',
        keywords: ['exam', 'examination', 'test', 'midterm', 'final'],
        variations: [
          'When are exams?',
          'Exam schedule',
          'Test dates',
        ],
        priority: 9,
        status: 'active',
      },
      {
        question: 'What is the attendance policy?',
        answer: 'Students must maintain a minimum of 75% attendance in each course to be eligible to sit for the final examination. Attendance is calculated based on:\n\n- Lectures\n- Laboratory sessions\n- Tutorials\n\nIn case of medical emergencies, students must submit a medical certificate to the course instructor within 3 days. The decision to grant attendance exemption rests with the department head.',
        category: 'academic_policies',
        keywords: ['attendance', 'policy', 'minimum', 'requirement'],
        variations: [
          'How much attendance is required?',
          'Attendance requirement',
        ],
        priority: 7,
        status: 'active',
      },
      {
        question: 'How is GPA calculated?',
        answer: 'GPA (Grade Point Average) is calculated using the following scale:\n\n- A+ (4.0): 90-100%\n- A (4.0): 85-89%\n- A- (3.7): 80-84%\n- B+ (3.3): 75-79%\n- B (3.0): 70-74%\n- B- (2.7): 65-69%\n- C+ (2.3): 60-64%\n- C (2.0): 55-59%\n- C- (1.7): 50-54%\n- D (1.0): 40-49%\n- F (0.0): Below 40%\n\nGPA = Σ(Grade Points × Credits) / Σ(Credits)',
        category: 'academic_policies',
        keywords: ['gpa', 'grade', 'grading', 'marks', 'score'],
        variations: [
          'How are grades calculated?',
          'GPA system',
          'Grading policy',
        ],
        priority: 7,
        status: 'active',
      },
      {
        question: 'What documents are required for admission?',
        answer: 'Required documents for admission:\n\n1. Completed application form\n2. High school transcripts (official)\n3. Standardized test scores (SAT/ACT for undergrad, GRE/GMAT for grad)\n4. Letter of recommendation (2-3)\n5. Statement of purpose\n6. Government-issued ID/Passport\n7. Passport-size photographs (2)\n8. Proof of English proficiency (TOEFL/IELTS for international students)\n\nAll documents must be submitted in PDF format through the online portal.',
        category: 'admissions',
        keywords: ['documents', 'requirements', 'admission', 'needed'],
        priority: 8,
        status: 'active',
      },
      {
        question: 'Can I pay fees in installments?',
        answer: 'Yes! The college offers an installment payment plan:\n\n- First installment (50%): Due at registration\n- Second installment (50%): Due mid-semester\n\nTo opt for the installment plan:\n1. Log in to the student portal\n2. Go to "Fee Payment"\n3. Select "Installment Plan"\n4. Follow the instructions\n\nNote: A processing fee of $25 applies to installment plans. Late payment fees of $10 per week apply after the due date.',
        category: 'fees',
        keywords: ['installment', 'payment plan', 'pay', 'partial'],
        priority: 6,
        status: 'active',
      },
    ]);

    logger.info('Database seeded successfully!');
    logger.info('='.repeat(50));
    logger.info('Test Accounts:');
    logger.info('Admin: admin@college.edu / admin123');
    logger.info('Student 1: john.doe@student.edu / student123');
    logger.info('Student 2: jane.smith@student.edu / student123');
    logger.info('Student 3: bob.johnson@student.edu / student123');
    logger.info('='.repeat(50));

    process.exit(0);
  } catch (error) {
    logger.error(`Error seeding database: ${error.message}`);
    logger.error(error.stack);
    process.exit(1);
  }
};

// Run seed function
seedDatabase();
