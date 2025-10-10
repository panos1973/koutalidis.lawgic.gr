import { NextPage } from 'next'
import { unified } from 'unified'
import markdown from 'remark-parse'
import docx from 'remark-docx'
import { saveAs } from 'file-saver'
import { DocumentDownload } from 'iconsax-react'
import { toast } from 'sonner'

interface Props {
  content: string
}

const ExportMessage: NextPage<Props> = ({ content }) => {
  // Enhanced court decision formatting function
  const formatCourtDecisionText = (text: string): string => {
    if (!text) return '';
    
    const sectionHeaders = [
      'ΑΠΟΦΑΣΗ',
      'ΣΚΕΠΤΙΚΟ',
      'ΙΣΤΟΡΙΚΟ',
      'ΝΟΜΙΚΟ ΜΕΡΟΣ',
      'ΠΡΑΓΜΑΤΙΚΑ ΠΕΡΙΣΤΑΤΙΚΑ',
      'ΑΙΤΙΟΛΟΓΙΚΟ',
      'ΔΙΑΤΑΞΗ',
      'ΓΙΑ ΤΟΥΣ ΛΟΓΟΥΣ ΑΥΤΟΥΣ',
      'ΑΠΟΦΑΣΙΖΕΙ',
      'ΔΙΚΑΙΟΛΟΓΗΤΙΚΑ',
      'ΣΥΜΠΕΡΑΣΜΑ',
      'ΕΠΙΛΟΓΟΣ',
      'Ι. ΙΣΤΟΡΙΚΟ',
      'ΙΙ. ΝΟΜΙΚΟ ΠΛΑΙΣΙΟ',
      'ΙΙΙ. ΣΚΕΠΤΙΚΟ',
      'IV. ΑΠΟΦΑΣΗ',
      'Α. ΙΣΤΟΡΙΚΟ',
      'Β. ΝΟΜΙΚΟ ΜΕΡΟΣ',
      'Γ. ΚΡΙΣΗ',
      'Δ. ΑΠΟΦΑΣΗ'
    ];
    
    let formattedText = text;
    
    // Normalize line breaks
    formattedText = formattedText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    
    // Format section headers as H2
    sectionHeaders.forEach(header => {
      const regex = new RegExp(`^(${header})(?=\\s|:|$)`, 'gmi');
      formattedText = formattedText.replace(regex, '\n## $1\n');
    });
    
    // Format numbered items as H3
    formattedText = formattedText.replace(/^(\d+)\.\s+(.+?)$/gm, '\n### $1. $2\n');
    
    // Format article references as bold
    formattedText = formattedText.replace(
      /(άρθρ(?:ο|α|ων)|Άρθρ(?:ο|α|ων))\s+(\d+(?:\s*[-,]\s*\d+)*)/gi,
      '**$1 $2**'
    );
    
    // Format law references as bold
    formattedText = formattedText.replace(
      /([Νν]\.?\s*\d{3,4}\/\d{4})/g,
      '**$1**'
    );
    
    return formattedText;
  };

  const cleanContent = (content: string): string => {
    let cleaned = content;
    
    // Step 1: Remove REFERENCES_USED section entirely
    cleaned = cleaned.replace(/REFERENCES_USED:\s*\[.*?\]\s*\n?/g, '');
    
    // Step 2: Remove reference tags [REF_X]
    cleaned = cleaned.replace(/\[REF_\d+\]/g, '');
    
    // Step 3: Handle HTML tags
    cleaned = cleaned
      .replace(/<br\s*\/?>/gi, '\n\n') // Replace <br> with double newline for better spacing
      .replace(/<b>|<\/b>/gi, '**') // Convert <b> to markdown bold
      .replace(/<strong>|<\/strong>/gi, '**') // Convert <strong> to markdown bold
      .replace(/<i>|<\/i>/gi, '*') // Convert <i> to markdown italic
      .replace(/<em>|<\/em>/gi, '*') // Convert <em> to markdown italic
      .replace(/<h1[^>]*>/gi, '\n# ') // Convert <h1> to markdown
      .replace(/<\/h1>/gi, '\n')
      .replace(/<h2[^>]*>/gi, '\n## ') // Convert <h2> to markdown
      .replace(/<\/h2>/gi, '\n')
      .replace(/<h3[^>]*>/gi, '\n### ') // Convert <h3> to markdown
      .replace(/<\/h3>/gi, '\n')
      .replace(/<[^>]*>?/gm, '') // Remove any other HTML tags
      .replace(/[\u200B-\u200D\uFEFF]/g, ''); // Remove zero-width characters
    
    // Step 4: Check if this is a court decision and apply special formatting
    const isCourtDecision = 
      cleaned.includes('ΑΠΟΦΑΣΗ') ||
      cleaned.includes('ΣΚΕΠΤΙΚΟ') ||
      cleaned.includes('ΔΙΚΑΣΤΗΡΙΟ') ||
      cleaned.includes('ΑΡΕΙΟΣ ΠΑΓΟΣ') ||
      cleaned.includes('ΕΦΕΤΕΙΟ') ||
      cleaned.includes('ΠΡΩΤΟΔΙΚΕΙΟ') ||
      cleaned.includes('άρθρο') ||
      cleaned.includes('Άρθρο') ||
      (cleaned.includes('ΚΠολΔ') || cleaned.includes('ΑΚ') || cleaned.includes('ΚΠΔ'));
    
    if (isCourtDecision) {
      cleaned = formatCourtDecisionText(cleaned);
    }
    
    // Step 5: Handle Questions Section
    const questionPatterns = [
      /(?:\*\*)?ΠΡΟΤΕΙΝΟΜΕΝΕΣ ΕΡΩΤΗΣΕΙΣ(?:\*\*)?:?\s*\n/gi,
      /(?:\*\*)?ΧΡΗΣΙΜΕΣ ΕΡΩΤΗΣΕΙΣ(?:\*\*)?:?\s*\n/gi,
      /(?:\*\*)?Προτεινόμενες Ερωτήσεις(?:\*\*)?:?\s*\n/gi,
      /(?:\*\*)?Suggested Questions(?:\*\*)?:?\s*\n/gi,
      /(?:\*\*)?Useful Questions(?:\*\*)?:?\s*\n/gi,
    ];
    
    // Find and format questions section
    for (const pattern of questionPatterns) {
      const match = cleaned.match(pattern);
      if (match) {
        const matchIndex = cleaned.indexOf(match[0]);
        const beforeQuestions = cleaned.substring(0, matchIndex);
        const questionsSection = cleaned.substring(matchIndex);
        
        // Extract the questions part
        const questionsText = questionsSection.substring(match[0].length);
        const questionsLines = questionsText.split('\n');
        
        // Format questions as a proper markdown list
        let formattedQuestions = '\n## ΠΡΟΤΕΙΝΟΜΕΝΕΣ ΕΡΩΤΗΣΕΙΣ\n\n';
        let questionNumber = 1;
        
        for (const line of questionsLines) {
          const trimmedLine = line.trim();
          if (trimmedLine && !trimmedLine.match(/^#{1,6}\s/)) {
            // Remove existing numbering if present
            const cleanedQuestion = trimmedLine
              .replace(/^\d+\.\s*/, '')
              .replace(/^[-*]\s*/, '')
              .trim();
            
            if (cleanedQuestion) {
              formattedQuestions += `${questionNumber}. ${cleanedQuestion}\n`;
              questionNumber++;
            }
          } else if (trimmedLine.match(/^#{1,6}\s/)) {
            // If we hit another section header, stop processing questions
            formattedQuestions += '\n' + trimmedLine;
            break;
          }
        }
        
        cleaned = beforeQuestions + formattedQuestions;
        break;
      }
    }
    
    // Step 6: Format Sources/Citations section if present
    cleaned = cleaned.replace(
      /(Πηγές|Sources|ΠΗΓΕΣ):\s*\n/gi,
      '\n## $1\n\n'
    );
    
    // Step 7: Clean up excessive newlines but preserve paragraph breaks
    cleaned = cleaned.replace(/\n{4,}/g, '\n\n\n'); // Max 3 newlines
    cleaned = cleaned.replace(/^\n+/, ''); // Remove leading newlines
    cleaned = cleaned.replace(/\n+$/, ''); // Remove trailing newlines
    
    return cleaned;
  };

  const exportAsDoc = async () => {
    try {
      const cleanedContent = cleanContent(content);
      
      console.log('Original content:', content);
      console.log('Cleaned content for processing:', cleanedContent);

      const processor = unified()
        .use(markdown)
        .use(docx, {
          output: 'blob',
          styles: {
            default: {
              document: {
                run: {
                  font: 'Arial',
                  size: 22, // 11pt for body text
                },
                paragraph: {
                  spacing: {
                    before: 120,
                    after: 120,
                  },
                },
              },
              heading1: {
                run: {
                  font: 'Arial',
                  bold: true,
                  size: 32, // 16pt for main headings
                },
                paragraph: {
                  spacing: {
                    before: 480,
                    after: 240,
                  },
                },
              },
              heading2: {
                run: {
                  font: 'Arial',
                  bold: true,
                  size: 28, // 14pt for subheadings
                },
                paragraph: {
                  spacing: {
                    before: 360,
                    after: 180,
                  },
                },
              },
              heading3: {
                run: {
                  font: 'Arial',
                  bold: true,
                  size: 24, // 12pt for sub-subheadings
                },
                paragraph: {
                  spacing: {
                    before: 240,
                    after: 120,
                  },
                },
              },
            },
          },
        } as any); // Type assertion to handle library type mismatch

      const doc = await processor.process(cleanedContent);
      const blob = await doc.result;

      // Create a more descriptive filename with proper timestamp
      const now = new Date();
      const timestamp = now.toLocaleString('el-GR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }).replace(/[/:]/g, '-').replace(/\s/g, '_');

      saveAs(
        blob as Blob,
        `Lawgic_Export_${timestamp}.docx`
      );

      toast.success('Το μήνυμα εξήχθη επιτυχώς');
    } catch (error) {
      console.error('Error during DOCX processing:', error);
      toast.error('Σφάλμα κατά την εξαγωγή του μηνύματος');
    }
  };

  return (
    <div>
      <button
        onClick={exportAsDoc}
        className="p-1 rounded hover:bg-gray-200"
        title="Εξαγωγή σε Word"
      >
        <DocumentDownload size={16} />
      </button>
    </div>
  );
};

export default ExportMessage;
