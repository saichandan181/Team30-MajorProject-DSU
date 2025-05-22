import React, { useState, useCallback, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { GoogleGenerativeAI } from '@google/generative-ai';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import {
  Upload,
  Eye,
  AlertCircle,
  Loader2,
  X,
  Camera,
  ZoomIn,
  Github,
  Linkedin,
  Mail,
  Moon,
  Sun,
  History,
  Download,
  Microscope
} from 'lucide-react';
import { ImageFiltersComponent } from './components/ImageFilters';
import { HistoryPanel } from './components/HistoryPanel';
import { useLocalStorage } from './hooks/useLocalStorage';
import { AnalysisResult, ImageFilters } from './types';
import { DR_LEVELS, DR_DESCRIPTIONS, DEFAULT_IMAGE_FILTERS } from './constants';

const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

const SYSTEM_PROMPT = `You are an expert ophthalmologist specializing in diabetic retinopathy (DR). 
Analyze the retinal image and classify it into one of these categories:
0: No DR - No visible signs of diabetic retinopathy
1: Mild DR - Presence of microaneurysms only
2: Moderate DR - More than just microaneurysms but less than severe DR
3: Severe DR - Any of: >20 intraretinal hemorrhages, definite venous beading, prominent IRMA
4: Proliferative DR - Presence of neovascularization and/or vitreous/preretinal hemorrhage

Respond with ONLY the number (0-4) that corresponds to the DR severity level.`;

function App() {
  const [darkMode, setDarkMode] = useLocalStorage('darkMode', true);
  const [image, setImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [prediction, setPrediction] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showFullImage, setShowFullImage] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useLocalStorage<AnalysisResult[]>('analysisHistory', []);
  const [imageFilters, setImageFilters] = useState<ImageFilters>(DEFAULT_IMAGE_FILTERS);

  useEffect(() => {
    document.documentElement.classList.add('dark');
  }, []);

  const analyzeImage = async (imageData: string): Promise<number> => {
    if (!import.meta.env.VITE_GEMINI_API_KEY) {
      throw new Error('Gemini API key is not configured');
    }

    try {
      const matches = imageData.match(/^data:([A-Za-z-+/]+);base64,(.+)$/);
      if (!matches || matches.length !== 3) {
        throw new Error('Invalid image format');
      }

      const [, mimeType, base64Data] = matches;
      
      if (!['image/jpeg', 'image/png'].includes(mimeType)) {
        throw new Error('Unsupported image format. Please use JPEG or PNG.');
      }

      const imageFileData = {
        inlineData: {
          data: base64Data,
          mimeType
        }
      };

      const timeoutMs = 30000;
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Analysis timed out. Please try again.')), timeoutMs);
      });

      const resultPromise = model.generateContent([SYSTEM_PROMPT, imageFileData]);
      const result = await Promise.race([resultPromise, timeoutPromise]) as any;

      if (!result || !result.response) {
        throw new Error('Failed to get a valid response from the AI model');
      }

      const response = await result.response;
      const text = response.text().trim();
      const level = parseInt(text);

      if (isNaN(level) || level < 0 || level > 4) {
        throw new Error('Invalid model response. Please try again.');
      }

      return level;
    } catch (err) {
      console.error('Gemini API error:', err);
      
      if (err instanceof Error) {
        if (err.message.includes('UNAUTHENTICATED')) {
          throw new Error('API key is invalid or expired. Please check your configuration.');
        }
        if (err.message.includes('PERMISSION_DENIED')) {
          throw new Error('Access denied. Please check your API key permissions.');
        }
        if (err.message.includes('RESOURCE_EXHAUSTED')) {
          throw new Error('API quota exceeded. Please try again later.');
        }
        if (err.message.includes('size') || err.message.includes('too large')) {
          throw new Error('Image size exceeds limits. Please use a smaller image (max 4MB).');
        }
        if (err.message.includes('timeout')) {
          throw new Error('Analysis timed out. Please try again.');
        }
        if (err.message.includes('network')) {
          throw new Error('Network error. Please check your internet connection.');
        }
        
        throw new Error(err.message);
      }
      
      throw new Error('Failed to analyze the image. Please try again.');
    }
  };

  const processImage = async (file: File): Promise<AnalysisResult> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = async () => {
        try {
          if (!reader.result || typeof reader.result !== 'string') {
            throw new Error('Failed to read image file');
          }

          const imageData = reader.result;
          const level = await analyzeImage(imageData);
          
          const result: AnalysisResult = {
            id: crypto.randomUUID(),
            timestamp: Date.now(),
            imageUrl: imageData,
            level,
            description: DR_DESCRIPTIONS[level as keyof typeof DR_DESCRIPTIONS]
          };

          resolve(result);
        } catch (err) {
          reject(err);
        }
      };

      reader.onerror = () => {
        reject(new Error('Failed to read the image file.'));
      };

      reader.readAsDataURL(file);
    });
  };

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    try {
      if (!['image/jpeg', 'image/png'].includes(file.type)) {
        throw new Error('Please upload a valid JPEG or PNG image.');
      }

      const maxSize = 4 * 1024 * 1024;
      if (file.size > maxSize) {
        throw new Error('Image size must be less than 4MB.');
      }

      setLoading(true);
      setError(null);
      setPrediction(null);

      const objectUrl = URL.createObjectURL(file);
      setImage(objectUrl);

      const result = await processImage(file);
      setPrediction(result);
      setHistory((prev) => [result, ...prev].slice(0, 10));

    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred. Please try again.');
      if (image) {
        URL.revokeObjectURL(image);
        setImage(null);
      }
    } finally {
      setLoading(false);
    }
  }, [setHistory]);

  const exportToPDF = async (result: AnalysisResult) => {
    try {
      const element = document.getElementById('analysis-result');
      if (!element) return;

      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#1a1a1a',
        windowWidth: element.scrollWidth,
        windowHeight: element.scrollHeight,
        onclone: (clonedDoc) => {
          const clonedElement = clonedDoc.getElementById('analysis-result');
          if (clonedElement) {
            clonedElement.style.transform = 'none';
            clonedElement.style.width = `${element.offsetWidth}px`;
            clonedElement.style.height = `${element.offsetHeight}px`;
          }
        }
      });

      const imgData = canvas.toDataURL('image/png', 1.0);
      
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
        compress: false
      });

      const imgProps = pdf.getImageProperties(imgData);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = pdfWidth - 20;
      const imgHeight = (imgProps.height * imgWidth) / imgProps.width;
      
      pdf.setFillColor(255, 255, 255);
      pdf.rect(0, 0, pdfWidth, pdfHeight, 'F');
      
      const x = 10;
      const y = (pdfHeight - imgHeight) / 2;
      
      pdf.addImage(imgData, 'PNG', x, y, imgWidth, imgHeight, undefined, 'FAST');
      
      pdf.setProperties({
        title: `Diabetic Retinopathy Analysis - ${DR_LEVELS[result.level as keyof typeof DR_LEVELS]}`,
        subject: 'Diabetic Retinopathy Detection Report',
        creator: 'DR Detection System',
        author: 'DR Detection Team',
        keywords: 'diabetic retinopathy, medical analysis, eye screening',
        creationDate: new Date()
      });

      const date = new Date().toISOString().split('T')[0];
      pdf.save(`dr-analysis-${date}-${result.id}.pdf`);
    } catch (error) {
      console.error('Failed to export PDF:', error);
    }
  };

  const resetAnalysis = () => {
    if (image) {
      URL.revokeObjectURL(image);
    }
    setImage(null);
    setPrediction(null);
    setError(null);
    setImageFilters(DEFAULT_IMAGE_FILTERS);
  };

  const deleteFromHistory = (id: string) => {
    setHistory((prev) => prev.filter((item) => item.id !== id));
  };

  const selectFromHistory = (result: AnalysisResult) => {
    setImage(result.imageUrl);
    setPrediction(result);
    setError(null);
    setShowHistory(false);
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png']
    },
    maxFiles: 1,
    multiple: false
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 transition-colors duration-300">
      <div className="fixed top-4 right-4 z-50 flex gap-2">
        <button
          onClick={() => setShowHistory(!showHistory)}
          className="p-2 rounded-full bg-gray-800/90 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-110"
          title="View history"
        >
          <History className="h-5 w-5 text-blue-400" />
        </button>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8 sm:py-12">
        <header className="text-center mb-8 sm:mb-16">
          <div className="inline-flex items-center justify-center p-2 sm:p-3 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full mb-4 sm:mb-6 shadow-lg transform hover:scale-110 transition-transform duration-300">
            <Microscope className="h-6 w-6 sm:h-8 sm:w-8 text-white" />
          </div>
          <h1 className="text-3xl sm:text-5xl font-bold mb-4 sm:mb-6 bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent animate-gradient px-4">
            Diabetic Retinopathy Detection
          </h1>
          <p className="text-lg sm:text-xl text-gray-300 max-w-3xl mx-auto leading-relaxed px-4">
            Upload a retinal image for instant AI-powered analysis of diabetic retinopathy severity.
          </p>
        </header>

        <div className="grid lg:grid-cols-2 gap-6 sm:gap-12">
          <div className="space-y-6 sm:space-y-8">
            <div
              {...getRootProps()}
              className={`relative border-2 border-dashed rounded-2xl p-6 sm:p-12 text-center cursor-pointer transition-all duration-300 transform hover:scale-[1.02]
                ${isDragActive 
                  ? 'border-blue-500 bg-blue-900/20 shadow-lg scale-[1.02]' 
                  : 'border-gray-700 hover:border-blue-500 hover:shadow-md'}`}
            >
              <input {...getInputProps()} />
              <div className="absolute inset-0 bg-gradient-to-br from-blue-900/20 to-purple-900/20 rounded-2xl pointer-events-none" />
              <Upload className="mx-auto h-12 w-12 sm:h-16 sm:w-16 text-blue-400 animate-bounce" />
              <p className="text-base sm:text-lg text-gray-200 font-medium mt-4">
                {isDragActive
                  ? 'Drop your retinal image here'
                  : 'Drag & drop your retinal image here'}
              </p>
              <p className="text-sm text-gray-400 mt-2">
                or click to browse files
              </p>
              <p className="text-xs sm:text-sm text-gray-500 mt-4">
                Supported formats: JPEG, PNG (max 4MB)
              </p>
            </div>

            {image && (
              <div className="space-y-4 sm:space-y-6 animate-fadeIn">
                <div className="relative group">
                  <div className="relative rounded-2xl overflow-hidden shadow-xl bg-gray-800 p-4">
                    <div className="absolute top-4 right-4 z-10 space-x-2">
                      <button
                        onClick={() => setShowFullImage(true)}
                        className="p-2 bg-gray-800/90 backdrop-blur rounded-full shadow-lg hover:bg-gray-700 transition-all duration-300 hover:scale-110"
                        title="View full size"
                      >
                        <ZoomIn className="h-5 w-5 text-gray-300" />
                      </button>
                      <button
                        onClick={resetAnalysis}
                        className="p-2 bg-gray-800/90 backdrop-blur rounded-full shadow-lg hover:bg-gray-700 transition-all duration-300 hover:scale-110"
                        title="Remove image"
                      >
                        <X className="h-5 w-5 text-gray-300" />
                      </button>
                    </div>
                    <img
                      src={image}
                      alt="Uploaded retinal scan"
                      className="w-full h-auto rounded-lg transform transition-transform duration-300 group-hover:scale-[1.02]"
                      style={{
                        filter: `brightness(${imageFilters.brightness}%) contrast(${imageFilters.contrast}%) saturate(${imageFilters.saturation}%)`
                      }}
                    />
                  </div>
                </div>

                <ImageFiltersComponent
                  filters={imageFilters}
                  onChange={setImageFilters}
                />
              </div>
            )}
          </div>

          <div className="relative">
            {showHistory ? (
              <div className="bg-gray-800 rounded-2xl shadow-xl p-4 sm:p-8 animate-slideIn">
                <div className="flex items-center justify-between mb-4 sm:mb-6">
                  <h2 className="text-xl sm:text-2xl font-bold text-white">Analysis History</h2>
                  <button
                    onClick={() => setShowHistory(false)}
                    className="p-2 text-gray-400 hover:text-gray-200 transition-colors"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
                <HistoryPanel
                  history={history}
                  onSelect={selectFromHistory}
                  onDelete={deleteFromHistory}
                  onExport={exportToPDF}
                />
              </div>
            ) : (
              <div id="analysis-result" className="bg-gray-800 rounded-2xl shadow-xl p-4 sm:p-8 relative overflow-hidden animate-fadeIn">
                <div className="absolute top-0 right-0 w-full h-2 bg-gradient-to-r from-blue-500 to-purple-500" />
                
                <div className="flex items-center justify-between mb-6 sm:mb-8">
                  <div className="flex items-center gap-2 sm:gap-3">
                    <Eye className="h-6 w-6 sm:h-7 sm:w-7 text-blue-400" />
                    <h2 className="text-xl sm:text-2xl font-bold text-white">Analysis Results</h2>
                  </div>
                  {prediction && (
                    <button
                      onClick={() => exportToPDF(prediction)}
                      className="p-2 text-blue-400 hover:text-blue-300 transition-colors"
                      title="Export to PDF"
                    >
                      <Download className="h-5 w-5" />
                    </button>
                  )}
                </div>

                {loading && (
                  <div className="flex flex-col items-center justify-center py-8 sm:py-12 animate-pulse">
                    <Loader2 className="h-10 w-10 sm:h-12 sm:w-12 text-blue-400 animate-spin mb-4" />
                    <p className="text-base sm:text-lg text-gray-300">Analyzing your retinal image...</p>
                    <p className="text-xs sm:text-sm text-gray-500 mt-2">This may take a few moments</p>
                  </div>
                )}

                {error && (
                  <div className="flex items-start gap-3 text-red-400 bg-red-900/20 p-4 sm:p-6 rounded-xl animate-shake">
                    <AlertCircle className="h-5 w-5 sm:h-6 sm:w-6 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium">Analysis Error</p>
                      <p className="text-sm sm:text-base text-red-400 mt-1">{error}</p>
                    </div>
                  </div>
                )}

                {prediction && (
                  <div className="space-y-6 sm:space-y-8 animate-slideUp">
                    <div className="bg-gradient-to-br from-blue-900/20 to-purple-900/20 p-4 sm:p-6 rounded-xl transform hover:scale-[1.02] transition-transform duration-300">
                      <h3 className="text-base sm:text-lg font-medium text-gray-200 mb-2 sm:mb-3">Severity Level</h3>
                      <p className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                        {DR_LEVELS[prediction.level as keyof typeof DR_LEVELS]}
                      </p>
                    </div>

                    <div className="transform hover:scale-[1.01] transition-transform duration-300">
                      <h3 className="text-base sm:text-lg font-medium text-gray-200 mb-2 sm:mb-3">Detailed Analysis</h3>
                      <p className="text-sm sm:text-base text-gray-300 leading-relaxed">{prediction.description}</p>
                    </div>

                    <div className="border-t border-gray-700 pt-4 sm:pt-6">
                      <h3 className="text-base sm:text-lg font-medium text-gray-200 mb-3 sm:mb-4">Severity Scale</h3>
                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 sm:gap-3">
                        {Object.entries(DR_LEVELS).map(([level, label]) => (
                          <div
                            key={level}
                            className={`p-2 sm:p-3 rounded-lg text-center transition-all duration-300
                              ${prediction.level === parseInt(level)
                                ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-lg scale-105'
                                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
                          >
                            <p className="text-xs sm:text-sm font-medium">{label}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <section className="mt-16 sm:mt-24 mb-12 sm:mb-16 max-w-4xl mx-auto">
          <div className="bg-gray-800 rounded-2xl shadow-xl overflow-hidden">
            <div className="p-4 sm:p-8">
              <h2 className="text-2xl sm:text-3xl font-bold mb-4 sm:mb-6 bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                Understanding Diabetic Retinopathy
              </h2>
              
              <div className="grid sm:grid-cols-2 gap-6 sm:gap-8">
                <div className="space-y-4">
                  <h3 className="text-lg sm:text-xl font-semibold text-white">What is Diabetic Retinopathy?</h3>
                  <p className="text-sm sm:text-base text-gray-300 leading-relaxed">
                    Diabetic retinopathy is a diabetes complication that affects the eyes. It occurs when high blood sugar levels damage blood vessels in the retina, the light-sensitive tissue at the back of the eye.
                  </p>
                  
                  <div className="bg-blue-900/20 p-3 sm:p-4 rounded-lg">
                    <h4 className="font-medium text-blue-300 mb-2">Key Facts:</h4>
                    <ul className="list-disc list-inside space-y-1 sm:space-y-2 text-sm sm:text-base text-gray-300">
                      <li>Leading cause of vision loss in working-age adults</li>
                      <li>Can develop in anyone with type 1 or type 2 diabetes</li>
                      <li>Often shows no symptoms in early stages</li>
                      <li>Early detection and treatment can prevent vision loss</li>
                    </ul>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-lg sm:text-xl font-semibold text-white">Stages and Symptoms</h3>
                  <div className="space-y-2 sm:space-y-3">
                    {Object.entries(DR_LEVELS).map(([level, stage]) => (
                      <div key={level} className="p-2 sm:p-3 bg-gray-700/50 rounded-lg">
                        <h4 className="font-medium text-white mb-1">{stage}</h4>
                        <p className="text-xs sm:text-sm text-gray-300">
                          {DR_DESCRIPTIONS[level as keyof typeof DR_DESCRIPTIONS]}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-6 sm:mt-8 p-3 sm:p-4 bg-purple-900/20 rounded-lg">
                <h3 className="text-lg sm:text-xl font-semibold text-purple-300 mb-2 sm:mb-3">Prevention Tips</h3>
                <div className="grid sm:grid-cols-2 gap-4 text-sm sm:text-base text-gray-300">
                  <div className="space-y-2">
                    <p className="font-medium">Lifestyle Management:</p>
                    <ul className="list-disc list-inside space-y-1">
                      <li>Control blood sugar levels</li>
                      <li>Maintain healthy blood pressure</li>
                      <li>Regular exercise</li>
                      <li>Balanced diet</li>
                    </ul>
                  </div>
                  <div className="space-y-2">
                    <p className="font-medium">Regular Monitoring:</p>
                    <ul className="list-disc list-inside space-y-1">
                      <li>Annual eye examinations</li>
                      <li>Monitor vision changes</li>
                      <li>Track blood sugar levels</li>
                      <li>Regular medical check-ups</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>

      <footer className="bg-gray-800/80 backdrop-blur-lg border-t border-gray-700 py-8 sm:py-12 mt-12 sm:mt-16">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-6 sm:mb-8">
            <h2 className="text-xl sm:text-2xl font-bold text-white mb-2">Our Team</h2>
            <div className="h-1 w-20 bg-gradient-to-r from-blue-500 to-purple-500 mx-auto rounded-full"></div>
          </div>
          
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 sm:gap-8 max-w-4xl mx-auto">
            <div className="text-center transform hover:scale-105 transition-transform duration-300">
              <h3 className="text-sm sm:text-base font-semibold text-white mb-1">S. Reddy Sai Chandan</h3>
              <div className="flex justify-center space-x-2">
                <button className="p-1.5 sm:p-2 text-gray-400 hover:text-blue-400 transition-colors">
                  <Github className="h-4 w-4 sm:h-5 sm:w-5" />
                </button>
                <button className="p-1.5 sm:p-2 text-gray-400 hover:text-blue-400 transition-colors">
                  <Linkedin className="h-4 w-4 sm:h-5 sm:w-5" />
                </button>
                <button className="p-1.5 sm:p-2 text-gray-400 hover:text-blue-400 transition-colors">
                  <Mail className="h-4 w-4 sm:h-5 sm:w-5" />
                </button>
              </div>
            </div>

            <div className="text-center transform hover:scale-105 transition-transform duration-300">
              <h3 className="text-sm sm:text-base font-semibold text-white mb-1">O Sowmyanath</h3>
              <div className="flex justify-center space-x-2">
                <button className="p-1.5 sm:p-2 text-gray-400 hover:text-blue-400 transition-colors">
                  <Github className="h-4 w-4 sm:h-5 sm:w-5" />
                </button>
                <button className="p-1.5 sm:p-2 text-gray-400 hover:text-blue-400 transition-colors">
                  <Linkedin className="h-4 w-4 sm:h-5 sm:w-5" />
                </button>
                <button className="p-1.5 sm:p-2 text-gray-400 hover:text-blue-400 transition-colors">
                  <Mail className="h-4 w-4 sm:h-5 sm:w-5" />
                </button>
              </div>
            </div>

            <div className="text-center transform hover:scale-105 transition-transform duration-300">
              <h3 className="text-sm sm:text-base font-semibold text-white mb-1">Sri Keerthi</h3>
              <div className="flex justify-center space-x-2">
                <button className="p-1.5 sm:p-2 text-gray-400 hover:text-blue-400 transition-colors">
                  <Github className="h-4 w-4 sm:h-5 sm:w-5" />
                </button>
                <button className="p-1.5 sm:p-2 text-gray-400 hover:text-blue-400 transition-colors">
                  <Linkedin className="h-4 w-4 sm:h-5 sm:w-5" />
                </button>
                <button className="p-1.5 sm:p-2 text-gray-400 hover:text-blue-400 transition-colors">
                  <Mail className="h-4 w-4 sm:h-5 sm:w-5" />
                </button>
              </div>
            </div>

            <div className="text-center transform hover:scale-105 transition-transform duration-300">
              <h3 className="text-sm sm:text-base font-semibold text-white mb-1">Srindhi</h3>
              <div className="flex justify-center space-x-2">
                <button className="p-1.5 sm:p-2 text-gray-400 hover:text-blue-400 transition-colors">
                  <Github className="h-4 w-4 sm:h-5 sm:w-5" />
                </button>
                <button className="p-1.5 sm:p-2 text-gray-400 hover:text-blue-400 transition-colors">
                  <Linkedin className="h- 5 sm:w-5" />
                </button>
                <button className="p-1.5 sm:p-2 text-gray-400 hover:text-blue-400 transition-colors">
                  <Mail className="h-4 w-4 sm:h-5 sm:w-5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;