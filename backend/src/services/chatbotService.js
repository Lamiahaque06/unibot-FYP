const { FAQ, Enrollment, Fee, Course, Document } = require('../models');
const logger = require('../utils/logger');

/**
 * Chatbot Service
 * Rule-based chatbot logic for interim version
 * Will be replaced with RAG + LLM in full implementation
 */

class ChatbotService {
  /**
   * Process user message and generate response
   * @param {string} message - User message
   * @param {Object} user - User object (optional for personalized responses)
   * @param {Array} conversationHistory - Previous messages for context
   * @returns {Object} - Response object
   */
  async processMessage(message, user = null, conversationHistory = []) {
    const startTime = Date.now();

    try {
      // Validate input
      if (!message || typeof message !== 'string') {
        throw new Error('Invalid message input');
      }

      // Clean and normalize message
      const normalizedMessage = message.trim().toLowerCase();

      if (!normalizedMessage) {
        return {
          content: 'Please enter a message.',
          metadata: {
            intent: 'empty',
            sources: [],
            confidence: 1,
            responseTime: Date.now() - startTime,
          },
        };
      }

      // Determine intent
      const intent = this.classifyIntent(normalizedMessage);
      logger.info(`Classified intent: ${intent} for message: ${message.substring(0, 50)}`);

      let response = '';
      let sources = [];

      // Map intents to FAQ categories (handle singular/plural differences)
      const intentToCategoryMap = {
        'admission': 'admissions',
        'examination': 'examinations',
        'hostel': 'hostel',
        'fees_general': 'fees',
        'academic_policies': 'academic_policies',
      };

      // Handle based on intent
      switch (intent) {
        case 'greeting':
          response = this.handleGreeting(user);
          break;

        case 'my_courses':
          if (!user) {
            response = 'Please log in to view your courses.';
          } else {
            response = await this.handleMyCoursesQuery(user);
            sources = ['student_enrollment_database'];
          }
          break;

        case 'my_fees':
          if (!user) {
            response = 'Please log in to view your fees.';
          } else {
            response = await this.handleMyFeesQuery(user);
            sources = ['student_fees_database'];
          }
          break;

        case 'course_info':
          response = await this.handleCourseInfoQuery(normalizedMessage);
          sources = ['course_catalog'];
          break;

        case 'admission':
        case 'hostel':
        case 'examination':
        case 'fees_general':
        case 'academic_policies':
          // Map intent to category name
          const category = intentToCategoryMap[intent] || intent;
          logger.info(`FAQ Query - Intent: ${intent}, Category: ${category}, Query: "${message}"`);
          response = await this.handleFAQQuery(normalizedMessage, category);
          logger.info(`FAQ Response found: ${!!response}, Response length: ${response?.length || 0}`);
          if (!response) {
            logger.warn(`No FAQ found for category: ${category}, falling back to unknown handler`);
            response = this.handleUnknown(user);
          } else {
            sources = ['faq_database'];
          }
          break;

        default:
          // Try FAQ matching
          const faqResponse = await this.handleFAQQuery(normalizedMessage);
          if (faqResponse) {
            response = faqResponse;
            sources = ['faq_database'];
          } else {
            response = this.handleUnknown(user);
          }
      }

      // Ensure response is not empty
      if (!response || typeof response !== 'string') {
        logger.error(`Empty or invalid response generated for intent: ${intent}`);
        response = this.handleUnknown(user);
      }

      const responseTime = Date.now() - startTime;

      const result = {
        content: response,
        metadata: {
          intent,
          sources,
          confidence: this.calculateConfidence(intent, response),
          responseTime,
        },
      };

      logger.info(`Chatbot response generated successfully - Intent: ${intent}, Length: ${response.length}`);
      return result;

    } catch (error) {
      logger.error(`Chatbot service error: ${error.message}`);
      logger.error(`Error stack: ${error.stack}`);

      const errorResponse = {
        content: 'I apologize, but I encountered an error processing your request. Please try again.',
        metadata: {
          intent: 'error',
          sources: [],
          confidence: 0,
          responseTime: Date.now() - startTime,
          error: error.message,
        },
      };

      return errorResponse;
    }
  }

  /**
   * Classify user intent from message
   * @param {string} message - Normalized message
   * @returns {string} - Intent classification
   */
  classifyIntent(message) {
    // Greeting patterns
    if (/^(hi|hello|hey|good morning|good afternoon|good evening)/.test(message)) {
      return 'greeting';
    }

    // My courses patterns - more flexible matching
    if (/my.{0,20}(courses|classes|schedule|timetable)|what courses|enrolled in|taking|what am i (taking|enrolled)/i.test(message)) {
      return 'my_courses';
    }

    // My fees patterns - more flexible matching
    if (/my.{0,20}(fees|payment|dues|outstanding|pending)|how much (do i owe|i need to pay)|fee status|what.*my.*fee/i.test(message)) {
      return 'my_fees';
    }

    // Course information patterns
    if (/(course|class).{0,10}(info|information|details|about)|tell me about.{0,30}course/i.test(message)) {
      return 'course_info';
    }

    // Admission patterns - prioritize over general
    if (/admission|apply.{0,20}(admission|college|university)|application.{0,20}(process|procedure)|how to.{0,20}(apply|enroll|join|register|get admitted)|enroll.{0,20}(process|procedure)/i.test(message)) {
      return 'admission';
    }

    // Hostel patterns - more specific
    if (/hostel|accommodation|dormitory|housing|residence|how to.{0,20}apply.{0,20}hostel|apply.{0,20}hostel/i.test(message)) {
      return 'hostel';
    }

    // Examination patterns - more specific
    if (/exam.{0,20}(schedule|date|when|time)|when.{0,20}exam|test.{0,20}(schedule|date)|midterm|final.{0,20}exam|examination.{0,20}(schedule|date)/i.test(message)) {
      return 'examination';
    }

    // Fees general patterns (only if not 'my fees')
    if (/tuition|fee.{0,20}(structure|cost|amount)|how much.{0,20}(cost|fee|tuition)|payment.{0,20}plan/i.test(message) && !/my.{0,20}fee/i.test(message)) {
      return 'fees_general';
    }

    // Academic policies
    if (/policy|policies|rule|regulation|gpa|grade.{0,20}(calculation|system)|attendance.{0,20}(policy|requirement)/i.test(message)) {
      return 'academic_policies';
    }

    return 'general';
  }

  /**
   * Calculate confidence score
   * @param {string} intent - Detected intent
   * @param {string} response - Generated response
   * @returns {number} - Confidence score (0-1)
   */
  calculateConfidence(intent, response) {
    if (intent === 'greeting') return 0.95;
    if (intent === 'my_courses' || intent === 'my_fees') return 0.9;
    if (response && response.length > 50) return 0.85;
    if (intent === 'general') return 0.5;
    return 0.7;
  }

  /**
   * Handle greeting
   */
  handleGreeting(user) {
    const greetings = [
      `Hello${user ? ' ' + user.profile.firstName : ''}! I'm your College Support Assistant. How can I help you today?`,
      `Hi there${user ? ' ' + user.profile.firstName : ''}! I'm here to assist you with information about courses, fees, admissions, and more. What would you like to know?`,
      `Welcome${user ? ' back, ' + user.profile.firstName : ''}! Feel free to ask me about your courses, fees, exam schedules, or any college-related questions.`,
    ];

    return greetings[Math.floor(Math.random() * greetings.length)];
  }

  /**
   * Handle "my courses" query
   */
  async handleMyCoursesQuery(user) {
    try {
      const enrollments = await Enrollment.find({
        student: user._id,
        status: 'enrolled',
      })
        .populate('course')
        .limit(10);

      if (enrollments.length === 0) {
        return "You are not currently enrolled in any courses. Would you like to browse available courses?";
      }

      let response = `You are currently enrolled in ${enrollments.length} course${enrollments.length > 1 ? 's' : ''}:\n\n`;

      enrollments.forEach((enrollment, index) => {
        const course = enrollment.course;
        response += `${index + 1}. ${course.courseCode} - ${course.courseName}\n`;
        response += `   Instructor: ${course.instructor.name}\n`;
        response += `   Credits: ${course.credits}\n\n`;
      });

      response += "Would you like more details about any specific course?";

      return response;
    } catch (error) {
      logger.error(`Error fetching courses: ${error.message}`);
      return "I'm having trouble retrieving your course information. Please try again later.";
    }
  }

  /**
   * Handle "my fees" query
   */
  async handleMyFeesQuery(user) {
    try {
      const fees = await Fee.find({
        student: user._id,
        status: { $in: ['pending', 'overdue', 'partial'] },
      }).sort({ dueDate: 1 });

      if (fees.length === 0) {
        return "Great news! You have no outstanding fees at the moment.";
      }

      const totalOutstanding = fees.reduce((sum, f) => sum + f.getRemainingBalance(), 0);

      let response = `You have ${fees.length} pending fee payment${fees.length > 1 ? 's' : ''}:\n\n`;

      fees.slice(0, 5).forEach((fee, index) => {
        const remaining = fee.getRemainingBalance();
        const daysUntilDue = fee.getDaysUntilDue();
        const status = daysUntilDue < 0 ? 'OVERDUE' : `Due in ${daysUntilDue} days`;

        response += `${index + 1}. ${fee.description}\n`;
        response += `   Amount: $${remaining.toFixed(2)}\n`;
        response += `   Due Date: ${fee.dueDate.toLocaleDateString()}\n`;
        response += `   Status: ${status}\n\n`;
      });

      response += `\nTotal Outstanding: $${totalOutstanding.toFixed(2)}\n\n`;
      response += "Please ensure timely payment to avoid late fees.";

      return response;
    } catch (error) {
      logger.error(`Error fetching fees: ${error.message}`);
      return "I'm having trouble retrieving your fee information. Please try again later.";
    }
  }

  /**
   * Handle course information query
   */
  async handleCourseInfoQuery(message) {
    try {
      // Extract potential course code (e.g., CS101, MATH201)
      const courseCodeMatch = message.match(/[A-Z]{2,4}\s?\d{3,4}/i);

      if (courseCodeMatch) {
        const courseCode = courseCodeMatch[0].replace(/\s/g, '').toUpperCase();
        const course = await Course.findOne({ courseCode });

        if (course) {
          let response = `**${course.courseCode} - ${course.courseName}**\n\n`;
          response += `${course.description}\n\n`;
          response += `**Details:**\n`;
          response += `- Credits: ${course.credits}\n`;
          response += `- Department: ${course.department}\n`;
          response += `- Instructor: ${course.instructor.name}\n`;
          response += `- Semester: ${course.semester} ${course.year}\n`;
          response += `- Available Seats: ${course.getAvailableSeats()} / ${course.maxEnrollment}\n`;

          if (course.prerequisites.length > 0) {
            response += `- Prerequisites: ${course.prerequisites.join(', ')}\n`;
          }

          return response;
        }
      }

      return "Could you please specify the course code? For example, 'Tell me about CS101' or 'What is MATH201?'";
    } catch (error) {
      logger.error(`Error fetching course info: ${error.message}`);
      return "I'm having trouble finding that course information. Please try again.";
    }
  }

  /**
   * Handle FAQ query
   */
  async handleFAQQuery(message, category = null) {
    try {
      logger.info(`handleFAQQuery called - Message: "${message}", Category: ${category}`);
      let matchingFAQs;

      if (category && category !== 'general') {
        // First try category-specific search
        const categoryFAQs = await FAQ.find({ category, status: 'active' });
        logger.info(`Found ${categoryFAQs?.length || 0} FAQs in category: ${category}`);

        if (categoryFAQs && categoryFAQs.length > 0) {
          const scoredFAQs = categoryFAQs.map((faq) => ({
            faq,
            score: faq.getMatchScore(message),
            question: faq.question,
          }));

          logger.info(`Scored FAQs:`, scoredFAQs.map(s => ({ question: s.question, score: s.score })));

          matchingFAQs = scoredFAQs
            .filter((item) => item.score > 0.2)
            .sort((a, b) => b.score - a.score)
            .slice(0, 3)
            .map((item) => item.faq);

          logger.info(`Matching FAQs after filter (score > 0.2): ${matchingFAQs.length}`);
        }
      }

      if (!matchingFAQs || matchingFAQs.length === 0) {
        // General FAQ search
        logger.info(`No category matches, trying general FAQ search`);
        matchingFAQs = await FAQ.findMatching(message, 3);
        logger.info(`General FAQ search found: ${matchingFAQs?.length || 0} matches`);
      }

      if (matchingFAQs && matchingFAQs.length > 0) {
        const topMatch = matchingFAQs[0];

        // Increment view count
        try {
          await topMatch.incrementViews();
        } catch (viewError) {
          logger.error(`Error incrementing FAQ views: ${viewError.message}`);
        }

        let response = topMatch.answer || 'I found a related question but the answer is not available.';

        // Add related questions if available
        if (matchingFAQs.length > 1) {
          response += '\n\n**Related questions:**\n';
          matchingFAQs.slice(1).forEach((faq, index) => {
            response += `${index + 1}. ${faq.question}\n`;
          });
        }

        return response;
      }

      return null;
    } catch (error) {
      logger.error(`Error fetching FAQ: ${error.message}`);
      logger.error(`Error stack: ${error.stack}`);
      return null;
    }
  }

  /**
   * Handle unknown query
   */
  handleUnknown(user) {
    return `I'm not sure how to answer that question. I can help you with:\n\n` +
      `- Your enrolled courses and schedule${user ? ' (say "my courses")' : ''}\n` +
      `- Your fee payments and dues${user ? ' (say "my fees")' : ''}\n` +
      `- Course information (e.g., "Tell me about CS101")\n` +
      `- Admission procedures\n` +
      `- Hostel information\n` +
      `- Examination schedules\n` +
      `- Academic policies\n\n` +
      `Please try rephrasing your question or ask about one of these topics.`;
  }
}

module.exports = new ChatbotService();
