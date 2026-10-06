# FAIZAN Math AI — V2

A red futuristic, browser-based math solver.

## V2.1 improvements
- Multi-pass OCR image preprocessing
- Automatic image-to-answer flow
- Better handling of printed division/fraction patterns
- Clear answer card with optional solution steps

## Features
- AI Version 2 branding
- Math expression solving
- Arithmetic with fractions
- Linear and quadratic equations
- Symbolic algebra
- Derivatives and integrals
- Trigonometric expressions
- Upload or camera image of a math problem
- Automatic OCR
- Automatic solve immediately after image upload
- Animated red mathematical background
- Mouse parallax
- Phone/device-motion parallax where supported
- Responsive mobile layout
- No backend and no OpenAI API key required

## Image solving
The image reader uses Tesseract.js. Clear printed images work best. OCR may make mistakes on handwriting, shadows, unusual fonts or complex multi-line notation. The detected expression is shown so it can be corrected before solving.

## Run in VS Code
1. Extract this ZIP.
2. Open the extracted folder in VS Code.
3. Open `index.html`.
4. Use Live Server.
5. Internet access is needed for the CDN libraries.

## GitHub Pages
Upload the project files to a GitHub repository. In Settings > Pages choose Deploy from a branch, select `main` and `/ (root)`.

Developed by FAIZAN.


## Word-problem image mode
V2.2 adds full-question OCR and a dedicated dynamic-pressure pattern. For textbook images that include a formula plus a paragraph, the app keeps the full OCR text and can solve the dynamic-pressure ratio problem automatically. OCR is still best with clear, high-resolution printed images.


## V2.3 universal image flow
The image pipeline now uses multiple OCR passes, preprocessing, high-confidence printed-symbol repair, arithmetic solving, equation solving, and word-problem detection. It is designed to cover common textbook math/physics images, but no browser OCR can guarantee 100% accuracy for every handwriting, diagram, or unusual notation. The detected expression/question remains visible so an OCR mistake can be corrected.
