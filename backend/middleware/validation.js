const { body, validationResult } = require('express-validator');

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }
  next();
};

const signupValidation = [
  body('email')
    .isEmail()
    .withMessage('Please provide a valid email')
    .normalizeEmail(),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long'),
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Name is required')
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2 and 100 characters'),
  body('role')
    .isIn(['buyer', 'farmer'])
    .withMessage('Role must be either buyer or farmer'),
  body('address')
    .optional()
    .trim()
    .isLength({ min: 5, max: 500 })
    .withMessage('Address must be between 5 and 500 characters'),
  body('latitude')
    .optional()
    .isFloat({ min: -90, max: 90 })
    .withMessage('Valid latitude is required (-90 to 90)'),
  body('longitude')
    .optional()
    .isFloat({ min: -180, max: 180 })
    .withMessage('Valid longitude is required (-180 to 180)'),
  validate
];

const loginValidation = [
  body('email')
    .isEmail()
    .withMessage('Please provide a valid email')
    .normalizeEmail(),
  body('password')
    .notEmpty()
    .withMessage('Password is required'),
  validate
];

const productValidation = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Product name is required')
    .isLength({ min: 2, max: 255 })
    .withMessage('Product name must be between 2 and 255 characters'),
  body('description')
    .optional()
    .trim(),
  body('price')
    .isFloat({ min: 0.01 })
    .withMessage('Price must be a positive number'),
  body('quantity')
    .isFloat({ min: 0.01 })
    .withMessage('Quantity must be a positive number'),
  body('unit')
    .optional()
    .trim(),
  body('category')
    .optional()
    .trim(),
  validate
];

const orderValidation = [
  body('product_id')
    .isUUID()
    .withMessage('Valid product ID is required'),
  body('quantity')
    .isFloat({ min: 0.01 })
    .withMessage('Quantity must be a positive number'),
  body('buyer_address')
    .optional()
    .trim(),
  body('buyer_latitude')
    .optional()
    .isFloat()
    .withMessage('Valid latitude is required'),
  body('buyer_longitude')
    .optional()
    .isFloat()
    .withMessage('Valid longitude is required'),
  body('notes')
    .optional()
    .trim(),
  validate
];

const updateOrderStatusValidation = [
  body('status')
    .isIn(['pending', 'accepted', 'shipped', 'delivered', 'cancelled'])
    .withMessage('Invalid status value'),
  validate
];

const buyerProfileValidation = [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2 and 100 characters'),
  body('address')
    .optional()
    .trim(),
  body('latitude')
    .optional()
    .isFloat()
    .withMessage('Valid latitude is required'),
  body('longitude')
    .optional()
    .isFloat()
    .withMessage('Valid longitude is required'),
  validate
];

module.exports = {
  signupValidation,
  loginValidation,
  productValidation,
  orderValidation,
  updateOrderStatusValidation,
  buyerProfileValidation
};
