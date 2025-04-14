import { useEffect, useState } from "react";
import { open } from '@tauri-apps/plugin-dialog';
import { useNavigate } from "react-router-dom";
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
      setHistory(data || []);
    };
    loadHistory();
  }, []);

  return (
    <div style={styles.container}>
      <h2 style={styles.title}>Recent</h2>
      
      <div style={styles.list}>
        {history.map((path, index) => (
          <div key={index} style={styles.listItem}>
            <div style={styles.nameSection}>
              <span style={styles.name}>
                {getDisplayName(path)}
              </span>
            </div>

            <div style={styles.pathSection}>
                {path}
            </div>
          </div>
        ))}
      </div>

      <div style={styles.moreLink}>More...</div>
    </div>
  );
};

// Maintain styles consistent with the image
const styles = {
  container: {
    backgroundColor: '#1a1a1a',
    color: 'white',
    padding: '16px',
    fontFamily: 'Consolas, monospace',
    borderRadius: '6px',
    maxWidth: '600px'
  },
  title: {
    fontSize: '18px',
    marginBottom: '12px',
    fontWeight: 500,
    borderBottom: '1px solid #333',
    paddingBottom: '8px'
  },
  list: {
    gap: '8px',
    display: 'flex',
    flexDirection: 'column' as const
  },
  listItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '8px',
    borderRadius: '4px',
    '&:hover': {
      backgroundColor: '#2d2d2d'
    }
  },
  nameSection: {
    minWidth: '120px'  // Maintain name alignment
  },
  name: {
    color: '#4dabf7',
    fontWeight: 500
  },
  pathSection: {
    color: '#dee2e6',
    maxWidth: '60%',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const
  },
  moreLink: {
    color: '#4dabf7',
    cursor: 'pointer',
    marginTop: '12px',
    fontSize: '0.9em',
    '&:hover': {
      textDecoration: 'underline'
    }
  }
};

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
        await addFileHistory(filePath);
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

      <FileHistoryList/>
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