
import React, { useState, useRef, useCallback, useMemo } from 'react';
import { DEFAULT_MARKDOWN } from './constants';

// TypeScript declarations for global libraries loaded via CDN
declare var marked: {
  parse(markdown: string): string;
};
declare var jspdf: any;
declare var html2canvas: any;

// --- Helper Components (Defined outside the main App component to prevent re-creation on re-renders) ---

const Header: React.FC = () => (
  <header className="bg-white border-b border-slate-200 p-4 sticky top-0 z-10">
    <div className="max-w-7xl mx-auto flex justify-between items-center">
      <h1 className="text-xl font-bold text-slate-800">Markdown Converter</h1>
    </div>
  </header>
);

interface MarkdownInputProps {
  value: string;
  onChange: (value: string) => void;
}

const MarkdownInput: React.FC<MarkdownInputProps> = ({ value, onChange }) => (
  <div className="h-full flex flex-col">
    <div className="p-2 bg-slate-100 border-b border-slate-200">
      <h2 className="font-semibold text-slate-600">Markdown Input</h2>
    </div>
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full h-full p-4 border-0 focus:ring-0 resize-none font-mono text-sm bg-white outline-none"
      placeholder="Type your markdown here..."
    />
  </div>
);

interface MarkdownPreviewProps {
  markdown: string;
}

const MarkdownPreview = React.forwardRef<HTMLDivElement, MarkdownPreviewProps>(({ markdown }, ref) => {
  const parsedHtml = useMemo(() => marked.parse(markdown), [markdown]);

  return (
    <div className="h-full flex flex-col bg-white">
      <div className="p-2 bg-slate-100 border-b border-slate-200">
        <h2 className="font-semibold text-slate-600">Live Preview</h2>
      </div>
      <div
        ref={ref}
        className="p-8 prose prose-slate max-w-none overflow-y-auto h-full"
        dangerouslySetInnerHTML={{ __html: parsedHtml }}
      />
    </div>
  );
});

interface ExportButtonsProps {
  onExportDocx: () => void;
  onExportPdf: () => void;
  isLoading: boolean;
}

const ExportButtons: React.FC<ExportButtonsProps> = ({ onExportDocx, onExportPdf, isLoading }) => {
  const commonButtonClasses = "px-4 py-2 rounded-md font-semibold text-sm transition-all duration-200 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed";
  
  return (
    <div className="p-4 bg-white border-t border-slate-200 flex items-center justify-end space-x-3 sticky bottom-0 z-10">
      <button
        onClick={onExportDocx}
        disabled={isLoading}
        className={`${commonButtonClasses} bg-blue-600 text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2`}
      >
        {isLoading ? 'Exporting...' : 'Export to DOCX'}
      </button>
      <button
        onClick={onExportPdf}
        disabled={isLoading}
        className={`${commonButtonClasses} bg-red-600 text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2`}
      >
        {isLoading ? 'Exporting...' : 'Export to PDF'}
      </button>
    </div>
  );
};


// --- Main Application Component ---

const App: React.FC = () => {
  const [markdown, setMarkdown] = useState<string>(DEFAULT_MARKDOWN);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const previewRef = useRef<HTMLDivElement>(null);

  const handleMarkdownChange = useCallback((value: string) => {
    setMarkdown(value);
  }, []);

  const handleExportDocx = useCallback(() => {
    if (!previewRef.current) return;
    setIsLoading(true);

    const content = previewRef.current.innerHTML;
    const header = "<html xmlns:o='urn:schemas-microsoft-com:office:office' " +
      "xmlns:w='urn:schemas-microsoft-com:office:word' " +
      "xmlns='http://www.w3.org/TR/REC-html40'>" +
      "<head><meta charset='utf-8'><title>Export HTML To Doc</title></head><body>";
    const footer = "</body></html>";
    const sourceHTML = header + content + footer;

    const source = 'data:application/vnd.ms-word;charset=utf-8,' + encodeURIComponent(sourceHTML);
    const fileDownload = document.createElement("a");
    document.body.appendChild(fileDownload);
    fileDownload.href = source;
    fileDownload.download = 'document.doc';
    fileDownload.click();
    document.body.removeChild(fileDownload);

    setIsLoading(false);
  }, []);

  const handleExportPdf = useCallback(async () => {
    if (!previewRef.current) return;
    setIsLoading(true);

    try {
      const { jsPDF } = jspdf;
      // Temporarily increase resolution for better quality
      const scale = 2;
      const canvas = await html2canvas(previewRef.current, {
          scale: scale,
          useCORS: true,
          windowWidth: previewRef.current.scrollWidth,
          windowHeight: previewRef.current.scrollHeight
      });
      
      const imgData = canvas.toDataURL('image/png');

      const pdf = new jsPDF({
        orientation: 'p',
        unit: 'px',
        format: 'a4'
      });
      
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      
      const imgWidth = canvas.width / scale;
      const imgHeight = canvas.height / scale;

      const ratio = imgWidth / imgHeight;
      const pdfRatio = pdfWidth / pdfHeight;

      let finalImgWidth, finalImgHeight;
      if (ratio > pdfRatio) {
          finalImgWidth = pdfWidth;
          finalImgHeight = pdfWidth / ratio;
      } else {
          finalImgHeight = pdfHeight;
          finalImgWidth = pdfHeight * ratio;
      }

      let y = 0;
      let position = 0;
      const pageHeight = pdf.internal.pageSize.height;
      let heightLeft = imgHeight;
      
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      pdf.save("document.pdf");
    } catch (error) {
      console.error("Failed to export PDF:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  return (
    <div className="flex flex-col h-screen">
      <Header />
      <main className="flex-grow grid grid-cols-1 md:grid-cols-2 overflow-hidden">
        <div className="h-full overflow-hidden border-r border-slate-200">
          <MarkdownInput value={markdown} onChange={handleMarkdownChange} />
        </div>
        <div className="h-full overflow-hidden">
          <MarkdownPreview ref={previewRef} markdown={markdown} />
        </div>
      </main>
      <ExportButtons 
        onExportDocx={handleExportDocx} 
        onExportPdf={handleExportPdf}
        isLoading={isLoading} 
      />
    </div>
  );
};

export default App;
