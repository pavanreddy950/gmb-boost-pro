import express from 'express';
import AIReviewService from '../services/aiReviewService.js';

const router = express.Router();
const aiReviewService = new AIReviewService();

// Generate AI review suggestions
router.post('/generate', async (req, res) => {
  try {
    const { businessName, location, businessType, reviewId } = req.body;

    if (!businessName || !location) {
      return res.status(400).json({
        error: 'Business name and location are required'
      });
    }

    console.log(`[AI Reviews] Generating suggestions for ${businessName} in ${location}${reviewId ? ` (Review ID: ${reviewId})` : ''}`);

    const suggestions = await aiReviewService.generateReviewSuggestions(
      businessName,
      location,
      businessType,
      reviewId
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
    const { businessName, reviewContent, reviewRating, reviewId } = req.body;

    if (!businessName || !reviewContent || !reviewRating) {
      return res.status(400).json({
        error: 'Business name, review content, and review rating are required'
      });
    }

    console.log(`[AI Reviews] Generating reply suggestions for review ID: ${reviewId}`);

    // Use AI service to generate contextual replies
    const replySuggestions = await aiReviewService.generateReplySuggestions(
      businessName,
      reviewContent,
      reviewRating,
      reviewId
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