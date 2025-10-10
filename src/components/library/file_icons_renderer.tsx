import React from "react";
import { FileIcon, defaultStyles } from "react-file-icon"; // Adjust import based on the actual library

// Props for the component
interface FileIconRendererProps {
  fileType: string;
}

const FileIconRenderer: React.FC<FileIconRendererProps> = ({ fileType }) => {
  let file = fileType.split("/")[1];
  let styles = { ...defaultStyles.txt };

  if (fileType.endsWith("pdf")) {
    styles = { ...defaultStyles.pdf };
  } else if (fileType.endsWith("docx") || fileType.endsWith("document")) {
    file = "docx";
    styles = { ...defaultStyles.docx };
  } else if (fileType.endsWith("csv") || fileType.endsWith("xls")) {
    file = "csv";
    styles = { ...defaultStyles.xls };
  } else if (fileType.endsWith("png")) {
    file = "png";
    styles = { ...defaultStyles.png };
  } else if (fileType.endsWith("jpg")) {
    file = "jpg";
    styles = { ...defaultStyles.jpg };
  } else if (fileType.endsWith("jpeg")) {
    file = "jpeg";
    styles = { ...defaultStyles.jpeg };
  } else if (fileType.endsWith("plain")) {
    file = "txt";
    styles = { ...defaultStyles.txt };
  }

  return <FileIcon extension={file} {...styles} />;
};

export default FileIconRenderer;
