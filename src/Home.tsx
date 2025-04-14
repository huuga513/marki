import { useEffect, useState } from "react";
import { open } from '@tauri-apps/plugin-dialog';
import { NavigateFunction, useNavigate } from "react-router-dom";
import { load } from '@tauri-apps/plugin-store';
const store = await load('store.json', { autoSave: false });

// Add file path to history record  
const addFileHistory = async (filePath: string) => {
  // Read existing history record  
  const current = await store.get<{ history: string[] }>("fileHistory");
  let history = current?.history || [];

  // Deduplicate and adjust position  
  history = history.filter(path => path !== filePath); // Remove old position (if exists)  
  history = [filePath, ...history]; // Insert to the front of the array  

  // Write updates  
  await store.set("fileHistory", { history });
  await store.save();
};

// Get sorted history record  
const getFileHistory = async (): Promise<string[]> => {
  const data = await store.get<{ history: string[] }>("fileHistory");
  return data?.history || []; // Already sorted from newest to oldest  
};

const navigateToFlashCardPage = (navigate: NavigateFunction, path: string) => {
  navigate('flash-card-deck', {
    state: {
      dir: path
    }
  });
}

const FileHistoryList = () => {
  const [history, setHistory] = useState<string[]>([]);

  // Extract the last segment of the path as the display name
  const getDisplayName = (path: string) => {
    const segments = path.split(/[\\/]/).filter(Boolean);
    return segments[segments.length - 1] || path;
  };

  // Load history from store
  useEffect(() => {
    const loadHistory = async () => {
      const data = await getFileHistory();
      setHistory(data.slice(0, 5) || []);
    };
    loadHistory();
  }, []);

  let navigate = useNavigate();

  const handlePathAction = (path: string) => {
    navigateToFlashCardPage(navigate, path);
  }

  return (
    <div>
      <h2>Recent</h2>
      <div>
        {history.map((path, index) => (
          <div key={index} style={{ marginBottom: 8 }}>
            {/* 无边框按钮样式 */}
            <a
              href="#" // 如果是路由链接可替换为 <Link to=...>
              style={{
                textDecoration: 'none',
                color: 'blue',
                cursor: 'pointer',
              }}
              onClick={(e) => {
                e.preventDefault(); // 阻止链接默认行为
                handlePathAction(path);
              }}
            >
              {getDisplayName(path)}
            </a>
            {/* Path 显示 */}
            <div style={{
              color: '#666',
              fontSize: 12,
              marginTop: 2 // 与按钮保持间距
            }}>
              {path}
            </div>
          </div>
        ))}
      </div>
      <div>More...</div>
    </div>
  );
};


const FileSelectButton = () => {
  const [isLoading, setIsLoading] = useState(false);
  let navgiate = useNavigate();

  const handleSelectFile = async () => {
    try {
      setIsLoading(true);

      const filePath = await selectFile();

      if (filePath) {
        await addFileHistory(filePath);
        navigateToFlashCardPage(navgiate, filePath);

      } else {
        console.log('用户取消选择');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '文件选择失败';
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

      <FileHistoryList />
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