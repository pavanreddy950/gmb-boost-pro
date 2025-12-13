/**
 * Comprehensive Category-Specific Review Generation Mapping
 * Maps Google Business Profile categories to specific review vocabulary, focus areas, and language patterns
 */

export const CATEGORY_REVIEW_MAPPING = {
  // HOSPITALITY & ACCOMMODATION
  'hotel': {
    focusAreas: ['rooms', 'service', 'cleanliness', 'amenities', 'location', 'staff'],
    commonPhrases: [
      'comfortable rooms', 'clean and spacious', 'friendly staff', 'great location',
      'excellent service', 'beautiful property', 'peaceful stay', 'wonderful amenities',
      'cozy atmosphere', 'convenient location', 'well-maintained', 'relaxing experience'
    ],
    specificAspects: [
      'room comfort', 'bathroom cleanliness', 'bed quality', 'air conditioning',
      'wifi connectivity', 'breakfast', 'parking', 'swimming pool', 'gym facilities',
      'room service', 'front desk service', 'check-in process', 'noise levels'
    ],
    customerExperiences: [
      'stayed for vacation', 'business trip', 'weekend getaway', 'family stay',
      'comfortable night sleep', 'enjoyed the facilities', 'relaxed by the pool'
    ]
  },

  'resort': {
    focusAreas: ['environment', 'nature', 'relaxation', 'facilities', 'service', 'activities'],
    commonPhrases: [
      'beautiful environment', 'peaceful nature', 'stunning views', 'serene atmosphere',
      'perfect getaway', 'amazing landscape', 'tranquil setting', 'breathtaking scenery',
      'lush greenery', 'picturesque location', 'paradise on earth', 'ultimate relaxation'
    ],
    specificAspects: [
      'natural surroundings', 'spa services', 'outdoor activities', 'scenic beauty',
      'recreational facilities', 'pool area', 'gardens', 'sunset views', 'wildlife',
      'hiking trails', 'beach access', 'water sports', 'wellness programs'
    ],
    customerExperiences: [
      'relaxing vacation', 'rejuvenating experience', 'peaceful retreat', 'nature escape',
      'memorable holiday', 'quality family time', 'romantic getaway', 'adventure activities'
    ]
  },

  // FOOD & BEVERAGE
  'restaurant': {
    focusAreas: ['food', 'taste', 'service', 'ambiance', 'menu', 'hygiene'],
    commonPhrases: [
      'delicious food', 'amazing taste', 'enjoyed the meal', 'fantastic flavors',
      'mouth-watering dishes', 'excellent cuisine', 'superb quality', 'fresh ingredients',
      'perfect seasoning', 'generous portions', 'beautifully presented', 'authentic taste'
    ],
    specificAspects: [
      'food quality', 'taste', 'portion size', 'presentation', 'menu variety',
      'cooking style', 'spice level', 'freshness', 'ingredients', 'food temperature',
      'serving speed', 'waiter service', 'cleanliness', 'seating comfort', 'atmosphere'
    ],
    customerExperiences: [
      'family dinner', 'lunch visit', 'dinner date', 'celebration meal', 'takeaway order',
      'enjoyed with friends', 'special occasion', 'quick bite', 'feast experience'
    ]
  },

  'cafe': {
    focusAreas: ['coffee', 'snacks', 'ambiance', 'wifi', 'seating', 'service'],
    commonPhrases: [
      'great coffee', 'cozy ambiance', 'perfect spot', 'relaxing atmosphere',
      'excellent beverages', 'tasty snacks', 'friendly vibe', 'comfortable seating',
      'peaceful environment', 'ideal workspace', 'charming decor', 'warm atmosphere'
    ],
    specificAspects: [
      'coffee quality', 'beverage variety', 'pastries', 'sandwiches', 'wifi speed',
      'seating comfort', 'music', 'lighting', 'decor', 'cleanliness',
      'barista skills', 'coffee aroma', 'brewing method', 'milk options'
    ],
    customerExperiences: [
      'morning coffee', 'work session', 'catch up with friends', 'reading time',
      'laptop work', 'afternoon break', 'study session', 'relaxing evening'
    ]
  },

  'bar': {
    focusAreas: ['drinks', 'atmosphere', 'music', 'service', 'crowd', 'entertainment'],
    commonPhrases: [
      'great drinks', 'lively atmosphere', 'fantastic music', 'amazing vibe',
      'excellent cocktails', 'fun crowd', 'perfect hangout', 'energetic ambiance',
      'impressive bartender', 'wide selection', 'cool place', 'happening spot'
    ],
    specificAspects: [
      'drink quality', 'cocktail variety', 'bartender skills', 'music selection',
      'crowd vibe', 'seating arrangement', 'lighting', 'dance floor', 'DJ',
      'happy hour deals', 'drink prices', 'food options', 'outdoor seating'
    ],
    customerExperiences: [
      'night out', 'friends gathering', 'after work drinks', 'weekend party',
      'live music enjoyment', 'celebration', 'casual hangout', 'date night'
    ]
  },

  // ELECTRONICS & TECHNOLOGY
  'electronics_repair': {
    focusAreas: ['repair quality', 'service', 'expertise', 'pricing', 'warranty', 'turnaround'],
    commonPhrases: [
      'fixed perfectly', 'expert service', 'quick repair', 'professional work',
      'problem solved', 'great technical knowledge', 'reliable service', 'honest pricing',
      'skilled technician', 'excellent diagnosis', 'quality repair', 'trustworthy service'
    ],
    specificAspects: [
      'repair time', 'technician expertise', 'parts quality', 'pricing transparency',
      'warranty offered', 'problem diagnosis', 'customer explanation', 'testing after repair',
      'original parts', 'workmanship', 'follow-up support', 'billing clarity'
    ],
    customerExperiences: [
      'laptop repaired', 'phone fixed', 'computer serviced', 'screen replaced',
      'data recovered', 'battery replaced', 'software issue solved', 'hardware upgrade'
    ]
  },

  'computer_store': {
    focusAreas: ['product range', 'service', 'expertise', 'pricing', 'warranty', 'support'],
    commonPhrases: [
      'wide selection', 'knowledgeable staff', 'good prices', 'helpful guidance',
      'quality products', 'expert advice', 'competitive rates', 'genuine products',
      'professional assistance', 'latest models', 'reliable store', 'trusted dealer'
    ],
    specificAspects: [
      'product variety', 'brand availability', 'pricing', 'staff knowledge',
      'after-sales support', 'warranty terms', 'product demos', 'customization options',
      'accessories availability', 'technical consultation', 'installation service', 'payment options'
    ],
    customerExperiences: [
      'bought laptop', 'purchased accessories', 'got expert advice', 'found perfect product',
      'upgraded computer', 'gaming setup', 'office equipment', 'student laptop'
    ]
  },

  'mobile_phone_shop': {
    focusAreas: ['phone models', 'service', 'pricing', 'accessories', 'support'],
    commonPhrases: [
      'latest models available', 'helpful staff', 'fair prices', 'good deals',
      'genuine products', 'excellent service', 'wide range', 'trusted shop',
      'professional guidance', 'authentic phones', 'great offers', 'reliable store'
    ],
    specificAspects: [
      'phone variety', 'brand options', 'pricing', 'exchange offers', 'accessories',
      'screen guards', 'cases', 'chargers', 'warranty', 'activation support',
      'data transfer', 'staff knowledge', 'payment options', 'EMI facility'
    ],
    customerExperiences: [
      'bought new phone', 'upgraded device', 'traded old phone', 'got accessories',
      'compared models', 'received guidance', 'found best deal', 'smooth purchase'
    ]
  },

  // HEALTH & WELLNESS
  'gym': {
    focusAreas: ['equipment', 'trainers', 'cleanliness', 'facilities', 'results', 'atmosphere'],
    commonPhrases: [
      'excellent equipment', 'knowledgeable trainers', 'clean facilities', 'motivating environment',
      'great workout space', 'modern machines', 'professional guidance', 'hygiene maintained',
      'spacious gym', 'friendly atmosphere', 'results-oriented', 'well-maintained'
    ],
    specificAspects: [
      'equipment variety', 'machine maintenance', 'trainer expertise', 'personal training',
      'group classes', 'cleanliness', 'locker rooms', 'shower facilities', 'music',
      'ventilation', 'air conditioning', 'space availability', 'crowd management', 'timing flexibility'
    ],
    customerExperiences: [
      'great workout', 'achieved fitness goals', 'weight loss journey', 'muscle building',
      'improved strength', 'healthy lifestyle', 'regular training', 'fitness transformation'
    ]
  },

  'salon': {
    focusAreas: ['services', 'stylists', 'hygiene', 'products', 'results', 'atmosphere'],
    commonPhrases: [
      'excellent haircut', 'professional styling', 'clean salon', 'skilled stylists',
      'beautiful results', 'relaxing experience', 'quality products', 'hygiene maintained',
      'expert hands', 'trendy styles', 'affordable prices', 'welcoming ambiance'
    ],
    specificAspects: [
      'haircut quality', 'styling skills', 'color application', 'product quality',
      'cleanliness', 'equipment sterilization', 'stylist experience', 'consultation',
      'pricing', 'appointment system', 'waiting time', 'salon ambiance', 'music'
    ],
    customerExperiences: [
      'haircut satisfaction', 'color transformation', 'styling for event', 'regular grooming',
      'hair treatment', 'relaxing session', 'complete makeover', 'party-ready look'
    ]
  },

  'spa': {
    focusAreas: ['treatments', 'therapists', 'ambiance', 'hygiene', 'relaxation', 'products'],
    commonPhrases: [
      'ultimate relaxation', 'soothing experience', 'professional therapists', 'peaceful ambiance',
      'rejuvenating treatments', 'stress relief', 'excellent massage', 'tranquil environment',
      'skilled hands', 'quality products', 'serene atmosphere', 'blissful experience'
    ],
    specificAspects: [
      'massage quality', 'therapist expertise', 'treatment variety', 'product quality',
      'cleanliness', 'ambiance', 'music', 'aromatherapy', 'privacy', 'facilities',
      'temperature control', 'towel quality', 'pricing', 'package deals'
    ],
    customerExperiences: [
      'stress relief', 'muscle relaxation', 'complete rejuvenation', 'peaceful escape',
      'body treatment', 'facial experience', 'couples massage', 'wellness day'
    ]
  },

  'clinic': {
    focusAreas: ['doctor expertise', 'treatment', 'facilities', 'staff', 'cleanliness', 'wait time'],
    commonPhrases: [
      'excellent doctor', 'proper treatment', 'clean clinic', 'caring staff',
      'accurate diagnosis', 'effective treatment', 'professional care', 'hygienic environment',
      'experienced doctor', 'patient-friendly', 'well-equipped', 'timely consultation'
    ],
    specificAspects: [
      'doctor expertise', 'diagnosis accuracy', 'treatment effectiveness', 'staff behavior',
      'cleanliness', 'equipment', 'waiting time', 'appointment system', 'consultation time',
      'explanation clarity', 'follow-up care', 'medicine prescription', 'pricing transparency'
    ],
    customerExperiences: [
      'health improvement', 'problem solved', 'regular checkup', 'effective treatment',
      'quick recovery', 'proper guidance', 'medical consultation', 'successful diagnosis'
    ]
  },

  // AUTOMOTIVE
  'car_repair': {
    focusAreas: ['service quality', 'expertise', 'pricing', 'parts', 'turnaround', 'warranty'],
    commonPhrases: [
      'expert mechanics', 'quality service', 'honest pricing', 'fixed perfectly',
      'reliable repair', 'skilled technicians', 'genuine parts', 'professional work',
      'trustworthy service', 'quick turnaround', 'transparent billing', 'problem solved'
    ],
    specificAspects: [
      'mechanic expertise', 'repair quality', 'parts quality', 'pricing', 'work timeline',
      'problem diagnosis', 'customer explanation', 'warranty', 'testing', 'cleanliness',
      'service records', 'billing transparency', 'pickup-drop facility'
    ],
    customerExperiences: [
      'car fixed', 'smooth driving', 'problem resolved', 'maintenance done',
      'service completed', 'issue diagnosed', 'reliable repair', 'vehicle running well'
    ]
  },

  'car_dealer': {
    focusAreas: ['car selection', 'sales staff', 'pricing', 'service', 'deals', 'documentation'],
    commonPhrases: [
      'wide selection', 'helpful sales team', 'good deals', 'smooth process',
      'excellent service', 'fair pricing', 'transparent dealings', 'professional staff',
      'quality vehicles', 'trusted dealer', 'hassle-free purchase', 'great experience'
    ],
    specificAspects: [
      'car variety', 'model availability', 'pricing', 'financing options', 'exchange value',
      'test drive', 'sales staff knowledge', 'negotiation', 'documentation speed',
      'delivery time', 'after-sales service', 'insurance help', 'vehicle condition'
    ],
    customerExperiences: [
      'car purchase', 'dream car', 'smooth buying', 'fair deal', 'good exchange',
      'financing arranged', 'perfect vehicle', 'satisfied customer'
    ]
  },

  // RETAIL & SHOPPING
  'clothing_store': {
    focusAreas: ['collection', 'quality', 'pricing', 'service', 'fitting', 'variety'],
    commonPhrases: [
      'trendy collection', 'good quality', 'reasonable prices', 'helpful staff',
      'wide variety', 'latest fashion', 'excellent fabric', 'stylish designs',
      'comfortable fitting', 'great selection', 'affordable rates', 'quality clothing'
    ],
    specificAspects: [
      'clothing quality', 'fabric', 'stitching', 'design variety', 'size availability',
      'fitting rooms', 'pricing', 'staff assistance', 'brand selection', 'seasonal collection',
      'exchange policy', 'billing speed', 'store ambiance', 'parking'
    ],
    customerExperiences: [
      'found perfect outfit', 'shopping spree', 'wardrobe update', 'party wear',
      'casual shopping', 'gift purchase', 'seasonal shopping', 'great finds'
    ]
  },

  'grocery_store': {
    focusAreas: ['freshness', 'variety', 'pricing', 'cleanliness', 'billing', 'staff'],
    commonPhrases: [
      'fresh products', 'good variety', 'reasonable prices', 'clean store',
      'quality items', 'well-organized', 'helpful staff', 'convenient location',
      'wide selection', 'fresh vegetables', 'good quality', 'hygienic store'
    ],
    specificAspects: [
      'product freshness', 'variety', 'pricing', 'billing speed', 'store cleanliness',
      'product arrangement', 'staff behavior', 'home delivery', 'quality check',
      'expiry dates', 'brand availability', 'parking', 'shopping convenience'
    ],
    customerExperiences: [
      'weekly shopping', 'fresh groceries', 'daily needs', 'monthly stock',
      'convenient shopping', 'quality products', 'smooth billing', 'regular visits'
    ]
  },

  // SERVICES
  'beauty_parlor': {
    focusAreas: ['services', 'professionals', 'hygiene', 'products', 'results', 'pricing'],
    commonPhrases: [
      'excellent service', 'skilled professionals', 'clean parlor', 'beautiful results',
      'quality products', 'affordable prices', 'hygiene maintained', 'expert hands',
      'friendly staff', 'relaxing experience', 'great makeover', 'professional work'
    ],
    specificAspects: [
      'service quality', 'professional skills', 'product quality', 'hygiene', 'pricing',
      'appointment system', 'waiting time', 'consultation', 'treatment effectiveness',
      'equipment cleanliness', 'parlor ambiance', 'staff behavior', 'packages offered'
    ],
    customerExperiences: [
      'bridal makeup', 'party look', 'facial treatment', 'regular grooming',
      'beauty services', 'makeover', 'special occasion', 'pampering session'
    ]
  },

  'dental_clinic': {
    focusAreas: ['dentist expertise', 'treatment', 'equipment', 'hygiene', 'pain management', 'staff'],
    commonPhrases: [
      'excellent dentist', 'painless treatment', 'modern equipment', 'hygienic clinic',
      'professional care', 'gentle handling', 'effective treatment', 'clean environment',
      'experienced dentist', 'comfortable treatment', 'quality care', 'patient-friendly'
    ],
    specificAspects: [
      'dentist expertise', 'treatment quality', 'pain management', 'equipment', 'hygiene',
      'staff behavior', 'waiting time', 'appointment system', 'explanation clarity',
      'procedure comfort', 'follow-up care', 'pricing', 'emergency service'
    ],
    customerExperiences: [
      'dental problem solved', 'painless extraction', 'teeth cleaning', 'cavity treatment',
      'root canal', 'orthodontic treatment', 'regular checkup', 'dental care'
    ]
  },

  'plumber': {
    focusAreas: ['expertise', 'problem solving', 'pricing', 'timing', 'quality', 'cleanliness'],
    commonPhrases: [
      'expert plumber', 'quick fix', 'honest pricing', 'reliable service',
      'problem solved', 'professional work', 'quality materials', 'timely service',
      'skilled worker', 'clean work', 'transparent charges', 'efficient service'
    ],
    specificAspects: [
      'expertise', 'problem diagnosis', 'work quality', 'materials used', 'pricing',
      'work speed', 'cleanliness', 'arrival time', 'explanation', 'warranty',
      'emergency service', 'billing transparency', 'follow-up support'
    ],
    customerExperiences: [
      'leak fixed', 'pipe repair', 'installation done', 'problem resolved',
      'emergency service', 'bathroom fitting', 'plumbing work', 'quick solution'
    ]
  },

  'electrician': {
    focusAreas: ['expertise', 'safety', 'problem solving', 'pricing', 'quality', 'timing'],
    commonPhrases: [
      'expert electrician', 'safe work', 'quick service', 'honest pricing',
      'problem solved', 'professional work', 'quality materials', 'skilled technician',
      'reliable service', 'proper installation', 'efficient work', 'trustworthy'
    ],
    specificAspects: [
      'expertise', 'safety measures', 'problem diagnosis', 'work quality', 'materials',
      'pricing', 'work speed', 'cleanliness', 'testing', 'explanation',
      'warranty', 'emergency availability', 'billing clarity'
    ],
    customerExperiences: [
      'wiring fixed', 'appliance installed', 'fault repaired', 'power restored',
      'emergency service', 'electrical work', 'problem solved', 'safe installation'
    ]
  },

  // EDUCATION
  'school': {
    focusAreas: ['education quality', 'teachers', 'facilities', 'environment', 'activities', 'results'],
    commonPhrases: [
      'excellent education', 'dedicated teachers', 'good facilities', 'safe environment',
      'quality teaching', 'holistic development', 'modern infrastructure', 'caring staff',
      'academic excellence', 'co-curricular activities', 'positive atmosphere', 'child-friendly'
    ],
    specificAspects: [
      'teaching quality', 'teacher dedication', 'classroom facilities', 'playground',
      'laboratories', 'library', 'extracurricular activities', 'sports', 'discipline',
      'parent communication', 'safety measures', 'transport', 'academic results'
    ],
    customerExperiences: [
      'child learning well', 'overall development', 'academic improvement', 'happy child',
      'good education', 'character building', 'skill development', 'positive growth'
    ]
  },

  'coaching_center': {
    focusAreas: ['teaching', 'faculty', 'study material', 'results', 'doubt clearing', 'tests'],
    commonPhrases: [
      'excellent coaching', 'experienced faculty', 'quality study material', 'great results',
      'effective teaching', 'doubt clearing', 'regular tests', 'focused approach',
      'competitive preparation', 'subject expertise', 'result-oriented', 'dedicated teachers'
    ],
    specificAspects: [
      'teaching quality', 'faculty expertise', 'study material', 'doubt sessions',
      'test series', 'result tracking', 'batch size', 'class timing', 'online classes',
      'personal attention', 'exam strategy', 'competitive preparation', 'success rate'
    ],
    customerExperiences: [
      'exam cleared', 'concept clarity', 'score improved', 'goal achieved',
      'entrance cracked', 'learning progress', 'competitive success', 'knowledge gained'
    ]
  },

  // ENTERTAINMENT
  'movie_theater': {
    focusAreas: ['screen quality', 'sound', 'seating', 'cleanliness', 'food', 'service'],
    commonPhrases: [
      'great screen', 'excellent sound', 'comfortable seating', 'clean theater',
      'good food options', 'nice ambiance', 'quality projection', 'spacious seats',
      'premium experience', 'latest technology', 'well-maintained', 'enjoyable experience'
    ],
    specificAspects: [
      'screen quality', 'sound system', 'seating comfort', 'cleanliness', 'air conditioning',
      'food quality', 'snack variety', 'booking system', 'staff behavior', 'parking',
      'washroom cleanliness', 'ticket pricing', 'show timings', 'legroom'
    ],
    customerExperiences: [
      'movie enjoyment', 'great experience', 'comfortable viewing', 'fun outing',
      'family entertainment', 'weekend movie', 'premium show', 'blockbuster watch'
    ]
  },

  // PET SERVICES
  'pet_store': {
    focusAreas: ['pet variety', 'health', 'products', 'staff knowledge', 'care', 'pricing'],
    commonPhrases: [
      'healthy pets', 'wide variety', 'quality products', 'knowledgeable staff',
      'good care', 'fair prices', 'genuine accessories', 'well-maintained',
      'pet-friendly staff', 'quality food', 'trusted store', 'expert guidance'
    ],
    specificAspects: [
      'pet health', 'variety available', 'pet care', 'product quality', 'staff knowledge',
      'pricing', 'pet food brands', 'accessories', 'vaccination records', 'breed information',
      'after-purchase support', 'pet grooming', 'health guarantee'
    ],
    customerExperiences: [
      'adopted pet', 'bought accessories', 'found perfect pet', 'quality products',
      'expert advice', 'pet care guidance', 'healthy animal', 'great service'
    ]
  },

  'veterinary_clinic': {
    focusAreas: ['doctor expertise', 'treatment', 'care', 'facilities', 'staff', 'emergency'],
    commonPhrases: [
      'excellent vet', 'caring treatment', 'expert care', 'good facilities',
      'compassionate doctor', 'effective treatment', 'pet-friendly', 'professional service',
      'experienced vet', 'quality care', 'emergency support', 'animal lover'
    ],
    specificAspects: [
      'vet expertise', 'treatment quality', 'pet handling', 'diagnosis', 'facilities',
      'staff care', 'emergency availability', 'surgery quality', 'pricing', 'follow-up',
      'medicine quality', 'cleanliness', 'appointment system', 'waiting time'
    ],
    customerExperiences: [
      'pet recovered', 'health improved', 'emergency care', 'successful treatment',
      'vaccination done', 'regular checkup', 'surgery success', 'pet healthy now'
    ]
  },

  // REAL ESTATE
  'real_estate_agency': {
    focusAreas: ['property options', 'agent knowledge', 'service', 'documentation', 'transparency', 'deals'],
    commonPhrases: [
      'wide property range', 'knowledgeable agents', 'professional service', 'transparent deals',
      'helpful guidance', 'good options', 'trusted agency', 'smooth process',
      'excellent support', 'fair dealing', 'property expertise', 'reliable service'
    ],
    specificAspects: [
      'property variety', 'agent knowledge', 'location expertise', 'pricing', 'negotiation',
      'documentation help', 'legal support', 'transparency', 'site visits', 'response time',
      'market knowledge', 'deal closure', 'follow-up', 'after-sales support'
    ],
    customerExperiences: [
      'property found', 'dream home', 'good investment', 'smooth purchase',
      'agent support', 'deal closed', 'perfect location', 'satisfied buyer'
    ]
  },

  // PROFESSIONAL SERVICES
  'lawyer': {
    focusAreas: ['expertise', 'case handling', 'communication', 'results', 'professionalism', 'fees'],
    commonPhrases: [
      'expert lawyer', 'professional handling', 'clear communication', 'positive results',
      'knowledgeable counsel', 'dedicated service', 'transparent fees', 'trustworthy',
      'excellent representation', 'legal expertise', 'case knowledge', 'reliable advisor'
    ],
    specificAspects: [
      'legal expertise', 'case handling', 'court representation', 'documentation', 'communication',
      'availability', 'case strategy', 'results', 'fee transparency', 'follow-up',
      'legal advice quality', 'professionalism', 'experience', 'client care'
    ],
    customerExperiences: [
      'case won', 'legal issue resolved', 'proper guidance', 'court representation',
      'documentation done', 'legal advice', 'positive outcome', 'justice achieved'
    ]
  },

  'accountant': {
    focusAreas: ['expertise', 'accuracy', 'service', 'tax planning', 'communication', 'reliability'],
    commonPhrases: [
      'expert accountant', 'accurate work', 'professional service', 'tax planning',
      'reliable advice', 'thorough knowledge', 'timely filing', 'transparent dealings',
      'financial expertise', 'trustworthy', 'detailed analysis', 'excellent guidance'
    ],
    specificAspects: [
      'accounting expertise', 'accuracy', 'tax knowledge', 'filing timeliness', 'documentation',
      'audit support', 'financial planning', 'GST compliance', 'ITR filing', 'communication',
      'availability', 'fee structure', 'business advice', 'record keeping'
    ],
    customerExperiences: [
      'taxes filed', 'financial clarity', 'tax saved', 'proper guidance',
      'audit completed', 'GST compliance', 'accurate accounts', 'stress-free filing'
    ]
  },

  // Add default fallback for uncategorized businesses
  'default': {
    focusAreas: ['service', 'quality', 'staff', 'experience', 'value', 'professionalism'],
    commonPhrases: [
      'excellent service', 'quality work', 'professional staff', 'great experience',
      'good value', 'friendly team', 'reliable service', 'highly professional',
      'satisfied customer', 'would recommend', 'trustworthy business', 'great service'
    ],
    specificAspects: [
      'service quality', 'professionalism', 'staff behavior', 'work quality', 'pricing',
      'timeliness', 'customer care', 'communication', 'attention to detail', 'reliability',
      'expertise', 'facilities', 'cleanliness', 'overall experience'
    ],
    customerExperiences: [
      'satisfied with service', 'good experience', 'problem solved', 'needs met',
      'expectations fulfilled', 'positive interaction', 'successful outcome', 'happy customer'
    ]
  }
};

/**
 * Get category mapping by matching Google Business Profile category
 * @param {string} gbpCategory - Google Business Profile category
 * @returns {object} Category-specific review mapping
 */
export function getCategoryMapping(gbpCategory) {
  if (!gbpCategory) {
    return CATEGORY_REVIEW_MAPPING.default;
  }

  const categoryLower = gbpCategory.toLowerCase();

  // Direct matches
  if (CATEGORY_REVIEW_MAPPING[categoryLower]) {
    return CATEGORY_REVIEW_MAPPING[categoryLower];
  }

  // Fuzzy matching for common variations
  const categoryMap = {
    // Hospitality
    'hotels': 'hotel',
    'motel': 'hotel',
    'lodge': 'hotel',
    'inn': 'hotel',
    'resort': 'resort',
    'resort_hotel': 'resort',

    // Food & Beverage
    'restaurant': 'restaurant',
    'restaurants': 'restaurant',
    'dining': 'restaurant',
    'eatery': 'restaurant',
    'food': 'restaurant',
    'cafe': 'cafe',
    'coffee_shop': 'cafe',
    'bistro': 'cafe',
    'bar': 'bar',
    'pub': 'bar',
    'lounge': 'bar',

    // Electronics & Technology
    'electronics': 'electronics_repair',
    'computer_repair': 'electronics_repair',
    'laptop_repair': 'electronics_repair',
    'phone_repair': 'electronics_repair',
    'mobile_repair': 'electronics_repair',
    'computer_store': 'computer_store',
    'electronics_store': 'computer_store',
    'mobile_phone': 'mobile_phone_shop',
    'cell_phone': 'mobile_phone_shop',

    // Health & Wellness
    'gym': 'gym',
    'fitness': 'gym',
    'fitness_center': 'gym',
    'health_club': 'gym',
    'salon': 'salon',
    'hair_salon': 'salon',
    'barber': 'salon',
    'spa': 'spa',
    'wellness': 'spa',
    'massage': 'spa',
    'clinic': 'clinic',
    'medical': 'clinic',
    'doctor': 'clinic',

    // Automotive
    'auto_repair': 'car_repair',
    'car_service': 'car_repair',
    'mechanic': 'car_repair',
    'garage': 'car_repair',
    'car_dealer': 'car_dealer',
    'auto_dealer': 'car_dealer',

    // Retail
    'clothing': 'clothing_store',
    'apparel': 'clothing_store',
    'fashion': 'clothing_store',
    'boutique': 'clothing_store',
    'grocery': 'grocery_store',
    'supermarket': 'grocery_store',
    'convenience': 'grocery_store',

    // Services
    'beauty': 'beauty_parlor',
    'beauty_salon': 'beauty_parlor',
    'dentist': 'dental_clinic',
    'dental': 'dental_clinic',
    'plumbing': 'plumber',
    'plumbing_service': 'plumber',
    'electrical': 'electrician',
    'electrician': 'electrician',

    // Education
    'school': 'school',
    'education': 'school',
    'coaching': 'coaching_center',
    'tuition': 'coaching_center',
    'training': 'coaching_center',

    // Entertainment
    'cinema': 'movie_theater',
    'theater': 'movie_theater',
    'movies': 'movie_theater',

    // Pet Services
    'pet': 'pet_store',
    'pet_shop': 'pet_store',
    'veterinarian': 'veterinary_clinic',
    'vet': 'veterinary_clinic',
    'animal_hospital': 'veterinary_clinic',

    // Real Estate
    'real_estate': 'real_estate_agency',
    'property': 'real_estate_agency',

    // Professional Services
    'law': 'lawyer',
    'legal': 'lawyer',
    'attorney': 'lawyer',
    'accounting': 'accountant',
    'tax': 'accountant',
    'cpa': 'accountant'
  };

  // Try fuzzy matching
  for (const [key, value] of Object.entries(categoryMap)) {
    if (categoryLower.includes(key) || key.includes(categoryLower)) {
      return CATEGORY_REVIEW_MAPPING[value] || CATEGORY_REVIEW_MAPPING.default;
    }
  }

  // Fallback to default
  console.log(`[Category Mapping] No specific mapping found for "${gbpCategory}", using default`);
  return CATEGORY_REVIEW_MAPPING.default;
}

/**
 * Generate category-specific prompt additions
 * @param {string} gbpCategory - Google Business Profile category
 * @returns {string} Category-specific prompt text
 */
export function generateCategoryPrompt(gbpCategory) {
  const mapping = getCategoryMapping(gbpCategory);

  return `
BUSINESS CATEGORY: ${gbpCategory || 'General Business'}

CATEGORY-SPECIFIC GUIDELINES:
Focus Areas: ${mapping.focusAreas.join(', ')}

Use these types of phrases naturally (pick 2-3 per review):
${mapping.commonPhrases.slice(0, 8).join(', ')}

Mention these specific aspects (pick 2-3 per review):
${mapping.specificAspects.slice(0, 8).join(', ')}

Customer experience context (pick 1 per review):
${mapping.customerExperiences.slice(0, 5).join(', ')}

CRITICAL: Reviews MUST sound authentic to this business category. Use industry-specific vocabulary and customer language.
`;
}
