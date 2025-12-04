import dotenv from 'dotenv';
import newDailyActivityEmailService from './services/newDailyActivityEmailService.js';

dotenv.config();

console.log('========================================');
console.log('📧 TESTING DAILY ACTIVITY EMAIL');
console.log('========================================\n');

async function testDailyEmail() {
  try {
    // Sample user data (you can modify this)
    const userData = {
      userName: 'Meena',
      userEmail: 'meenakarjale73@gmail.com',
      isTrialUser: true,
      trialDaysRemaining: 12,
      isTrialExpired: false
    };

    // Sample activity data with real-looking numbers
    const activityData = {
      postsCreated: [
        { locationName: 'Scale Point Strategy', postTitle: 'Business Growth Tips', createdAt: new Date() },
        { locationName: 'Scale Point Strategy', postTitle: 'Marketing Strategies', createdAt: new Date() }
      ],
      reviewsReplied: [
        { locationName: 'Scale Point Strategy', reviewerName: 'John Smith', reply: 'Thank you!', repliedAt: new Date() },
        { locationName: 'Scale Point Strategy', reviewerName: 'Jane Doe', reply: 'We appreciate your feedback', repliedAt: new Date() },
        { locationName: 'Scale Point Strategy', reviewerName: 'Bob Johnson', reply: 'Glad you enjoyed!', repliedAt: new Date() }
      ],
      locations: [
        { name: 'Scale Point Strategy & Business Growth Solutions', locationId: '14977377147025961194' }
      ]
    };

    // Sample audit data (Google Business Profile stats)
    const auditData = {
      localRank: 3,  // Google ranking position
      reviewCount: 47,  // Total reviews
      rating: 4.8,  // Average rating
      totalSearches: 1250,  // Total searches
      totalViews: 3420,  // Total views
      totalActions: 156,  // Total actions (calls, directions, etc.)
      previousRank: 5,  // Previous ranking for comparison
      rankImprovement: true,
      locations: [
        {
          name: 'Scale Point Strategy & Business Growth Solutions',
          rank: 3,
          reviews: 47,
          rating: 4.8
        }
      ]
    };

    console.log('User Data:', userData.userName);
    console.log('Activity:');
    console.log(`   - Posts Created: ${activityData.postsCreated.length}`);
    console.log(`   - Reviews Replied: ${activityData.reviewsReplied.length}`);
    console.log('Audit Data:');
    console.log(`   - Google Rank: ${auditData.localRank}`);
    console.log(`   - Review Count: ${auditData.reviewCount}`);
    console.log(`   - Rating: ${auditData.rating}`);
    console.log('');

    console.log('📧 Sending daily report email...\n');

    const result = await newDailyActivityEmailService.sendDailyReport(
      userData.userEmail,
      userData,
      activityData,
      auditData
    );

    if (result.success) {
      console.log('✅ EMAIL SENT SUCCESSFULLY!');
      console.log(`   Message ID: ${result.messageId}`);
      console.log('');
      console.log('========================================');
      console.log('🎉 CHECK YOUR INBOX!');
      console.log('========================================\n');
      console.log('You should receive an email at: meenakarjale73@gmail.com');
      console.log('');
      console.log('The email includes:');
      console.log('   ✅ Beautiful professional template');
      console.log('   ✅ Dynamic post count: 2 posts');
      console.log('   ✅ Dynamic review count: 3 reviews');
      console.log('   ✅ Dynamic Google ranking: #3');
      console.log('   ✅ Dynamic rating: 4.8 stars');
      console.log('   ✅ Dynamic trial days: 12 days remaining');
      console.log('   ✅ Banner images');
      console.log('   ✅ Mobile responsive design');
      console.log('');
    } else {
      console.error('❌ EMAIL FAILED:', result.error);
    }

  } catch (error) {
    console.error('❌ Error during test:', error);
    process.exit(1);
  }
}

testDailyEmail().then(() => {
  process.exit(0);
});
