# Diabetic Retinopathy Detection

A web application for detecting and classifying diabetic retinopathy (DR) from retinal images using AI.

## Overview

This application uses Vision Transformer and EfficientNet to analyze retinal images and classify them according to the severity of diabetic retinopathy. It provides a user-friendly interface for uploading images, viewing analysis results, and managing a history of previous analyses.

## Features

- **Image Upload**: Drag and drop or select retinal images for analysis
- **ML-Powered Analysis**: Automatic classification of diabetic retinopathy severity
- **Image Enhancement**: Adjust brightness, contrast, and saturation for better visualization
- **Analysis History**: View and manage previous analyses
- **PDF Export**: Generate and download PDF reports of analysis results
- **Dark/Light Mode**: Toggle between dark and light themes
- **Responsive Design**: Works on desktop and mobile devices

## Diabetic Retinopathy Classification

The application classifies images into five severity levels:

- **Level 0**: No DR - No visible signs of diabetic retinopathy
- **Level 1**: Mild DR - Presence of microaneurysms only
- **Level 2**: Moderate DR - More than just microaneurysms but less than severe DR
- **Level 3**: Severe DR - Any of: >20 intraretinal hemorrhages, definite venous beading, prominent IRMA
- **Level 4**: Proliferative DR - Presence of neovascularization and/or vitreous/preretinal hemorrhage

## Technology Stack

- **Frontend**: React, TypeScript, Vite
- **Styling**: Tailwind CSS
- **ML Model**: VIT & Efficientnet (Hybrid Model)
- **Image Processing**: HTML5 Canvas, html2canvas
- **PDF Generation**: jsPDF
- **File Handling**: react-dropzone

## Getting Started

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- Google Gemini API key

### Installation

1. Clone the repository:
   ```
   git clone https://github.com/saichandan181/Team30-MajorProject-DSU
   cd diabeticrethinopathy
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Start the development server:
   ```
   npm run dev
   ```

4. Open your browser and navigate to `http://localhost:5173`

## Usage

1. Upload a retinal image by dragging and dropping it onto the designated area or clicking to select a file
2. Wait for the ML analysis to complete
3. View the classification result and description
4. Adjust image filters if needed for better visualization
5. Export the result as a PDF if desired
6. Access previous analyses from the history panel

## Limitations

- Maximum image size: 4MB
- Supported formats: JPEG, PNG
- Analysis may take up to 30 seconds depending on image complexity and server load

