import express from 'express';
import AIReviewService from '../services/aiReviewService.js';

const router = express.Router();
const aiReviewService = new AIReviewService();

// Generate AI review suggestions
router.post('/generate', async (req, res) => {
  try {
    const { businessName, location, businessType, reviewId, keywords, businessCategory } = req.body;

    if (!businessName || !location) {
      return res.status(400).json({
        error: 'Business name and location are required'
      });
    }

    console.log(`\n========================================`);
    console.log(`[AI Reviews] 🎯 NEW REVIEW GENERATION REQUEST`);
    console.log(`========================================`);
    console.log(`[AI Reviews] Business: ${businessName}`);
    console.log(`[AI Reviews] Location: ${location}`);
    console.log(`[AI Reviews] Review ID: ${reviewId || 'none'}`);
    console.log(`[AI Reviews] 🔑 Keywords received: "${keywords || 'NONE'}"`);
    console.log(`[AI Reviews] 📋 Business Category: ${businessCategory || 'not specified'}`);

    if (!keywords || keywords.trim() === '') {
      console.warn(`[AI Reviews] ⚠️ WARNING: No keywords provided! Reviews will be generic.`);
      console.warn(`[AI Reviews] ⚠️ Keywords should be set in autoposting settings and fetched when generating QR code.`);
    } else {
      console.log(`[AI Reviews] ✅ Keywords will be used to generate specific reviews`);
    }
    console.log(`========================================\n`);

    const suggestions = await aiReviewService.generateReviewSuggestions(
      businessName,
      location,
      businessType,
      reviewId,
      keywords, // Pass keywords to AI service
      businessCategory // Pass business category to AI service
    );

    res.json({
      success: true,
      suggestions,
      generatedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error generating review suggestions:', error);
    res.status(500).json({
      error: 'Failed to generate review suggestions',
      message: error.message
    });
  }
});

// Generate review link for a specific place
router.post('/review-link', async (req, res) => {
  try {
    const { placeId, businessName, location } = req.body;
    
    let reviewLink;
    if (placeId) {
      reviewLink = aiReviewService.generateReviewLink(placeId);
    } else if (businessName && location) {
      reviewLink = aiReviewService.generateMapsSearchLink(businessName, location);
    } else {
      return res.status(400).json({ 
        error: 'Either placeId or businessName and location are required' 
      });
    }
    
    res.json({ 
      success: true,
      reviewLink 
    });
  } catch (error) {
    console.error('Error generating review link:', error);
    res.status(500).json({ 
      error: 'Failed to generate review link' 
    });
  }
});

// Generate reply suggestions for a specific review
router.post('/reply-suggestions', async (req, res) => {
  try {
    const { businessName, reviewContent, reviewRating, reviewId, keywords, businessCategory } = req.body;

    if (!businessName || !reviewContent || !reviewRating) {
      return res.status(400).json({
        error: 'Business name, review content, and review rating are required'
      });
    }

    console.log(`[AI Reviews] Generating reply suggestions for review ID: ${reviewId}`);
    console.log(`[AI Reviews] Keywords: ${keywords || 'none provided'}`);
    console.log(`[AI Reviews] Business Category: ${businessCategory || 'not specified'}`);

    // Use AI service to generate contextual replies with keywords
    const replySuggestions = await aiReviewService.generateReplySuggestions(
      businessName,
      reviewContent,
      reviewRating,
      reviewId,
      keywords, // Pass keywords to AI service
      businessCategory // Pass business category to AI service
    );

    res.json({
      success: true,
      suggestions: replySuggestions,
      reviewId,
      generatedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error generating reply suggestions:', error);
    res.status(500).json({
      error: 'Failed to generate reply suggestions',
      message: error.message
    });
  }
});

// Debug endpoint to check Azure OpenAI configuration
router.get('/config-check', async (req, res) => {
  try {
    const aiService = new AIReviewService();

    res.json({
      azureOpenAI: {
        hasEndpoint: !!aiService.azureEndpoint,
        hasApiKey: !!aiService.apiKey,
        hasDeployment: !!aiService.deploymentName,
        hasVersion: !!aiService.apiVersion,
        endpoint: aiService.azureEndpoint ? aiService.azureEndpoint.substring(0, 30) + '...' : 'NOT SET',
        deployment: aiService.deploymentName || 'NOT SET',
        version: aiService.apiVersion || 'NOT SET'
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;