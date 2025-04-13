import { useState } from "react";
import { open } from '@tauri-apps/plugin-dialog';
import { useNavigate } from "react-router-dom";
const FileSelectButton = () => {
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  let navgiate = useNavigate();

  const handleSelectFile = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const filePath = await selectFile();
      
      if (filePath) {
        setSelectedFile(filePath);
        console.log('已选择文件:', filePath);
        navgiate('flash-card-deck', {
          state: {
            dir: filePath
          }
        });

      } else {
        console.log('用户取消选择');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '文件选择失败';
      setError(errorMessage);
      console.error('文件选择错误:', errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="file-selector">
      <button 
        onClick={handleSelectFile}
        disabled={isLoading}
        className="select-button"
        aria-label="选择文件"
      >
        {isLoading ? '选择中...' : '选择文件'}
      </button>

      {/* 显示状态信息 */}
      <div className="file-info">
        {selectedFile && (
          <p className="file-path">
            已选择文件: <code>{selectedFile}</code>
          </p>
        )}
        {error && (
          <p className="error-message" role="alert">
            ❌ 错误: {error}
          </p>
        )}
      </div>

    </div>
  );
};


async function selectFile(): Promise<string | null> {
  // Open a dialog
  const file = await open({
    multiple: false,
    directory: true,
  });
  console.log(file);
  return file;
}

export function Home() {
    return (
        <>
            <h1>Marki</h1>
            <FileSelectButton />
        </>
    )
}