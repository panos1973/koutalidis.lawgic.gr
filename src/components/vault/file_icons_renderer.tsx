import React from 'react'
import { FileIcon, defaultStyles } from 'react-file-icon' // Adjust import based on the actual library

// Define the default styles
// const defaultStyles: Record<string, FileIconProps> = {
//   txt: { color: '#000', glyphColor: '#fff', labelColor: '#000' },
//   pdf: { color: '#d32f2f', glyphColor: '#fff', labelColor: '#d32f2f' },
//   docx: { color: '#1976d2', glyphColor: '#fff', labelColor: '#1976d2' },
//   xls: { color: '#388e3c', glyphColor: '#fff', labelColor: '#388e3c' },
//   png: { color: '#ff9800', glyphColor: '#fff', labelColor: '#ff9800' },
//   jpg: { color: '#fbc02d', glyphColor: '#fff', labelColor: '#fbc02d' },
//   jpeg: { color: '#fbc02d', glyphColor: '#fff', labelColor: '#fbc02d' },
// };

// Props for the component
interface FileIconRendererProps {
  fileType: string
}

const FileIconRenderer: React.FC<FileIconRendererProps> = ({ fileType }) => {
  let file = fileType.split('/')[1]
  let styles = { ...defaultStyles.txt }

  if (fileType.endsWith('pdf')) {
    styles = { ...defaultStyles.pdf }
  } else if (fileType.endsWith('docx') || fileType.endsWith('document')) {
    file = 'docx'
    styles = { ...defaultStyles.docx }
  } else if (fileType.endsWith('doc') || fileType.includes('msword')) {
    file = 'doc'
    styles = { ...defaultStyles.docx } // Use same styling as docx
  } else if (fileType.endsWith('csv') || fileType.endsWith('xls')) {
    file = 'csv'
    styles = { ...defaultStyles.xls }
  } else if (fileType.endsWith('png')) {
    file = 'png'
    styles = { ...defaultStyles.png }
  } else if (fileType.endsWith('jpg')) {
    file = 'jpg'
    styles = { ...defaultStyles.jpg }
  } else if (fileType.endsWith('jpeg')) {
    file = 'jpeg'
    styles = { ...defaultStyles.jpeg }
  } else if (fileType.endsWith('plain')) {
    file = 'txt'
    //  styles = { ...defaultStyles.txt };
    styles = {
      color: '#e3f2fd',
      glyphColor: '#1976d2',
      labelColor: '#1976d2',
    }
  }

  return (
    <FileIcon
      extension={file}
      {...styles}
    />
  )
}

export default FileIconRenderer
