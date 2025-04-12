import { useState } from "react";
import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom';
import { invoke } from "@tauri-apps/api/core";
import { open } from '@tauri-apps/plugin-dialog';
import {FlashCardPage} from './FlashCard';
import "./App.css";
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
            filePath: filePath
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
    directory: false,
  });
  console.log(file);
  return file;
}
function App() {
  const [greetMsg, setGreetMsg] = useState("");
  const [name, setName] = useState("");

  async function greet() {
    // Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
    setGreetMsg(await invoke("greet", { name }));
  }

  const cardDeck: Array<[string, string]> = [
    ["<h3>问题1</h3>", "<p>答案1</p>"],
    ["<h3>问题2</h3>", "<p>答案2</p>"]
  ];


  return (
    <main className="container">
      <h1>Welcome to Tauri + React</h1>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<FileSelectButton />} />
          <Route path="/flash-card-deck" element={<FlashCardPage/>} />
        </Routes>
      </BrowserRouter>
    </main>
  );
}

export default App;
