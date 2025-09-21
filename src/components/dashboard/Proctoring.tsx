
"use client";

import { useEffect } from 'react';

export function Proctoring({ children }: { children?: React.ReactNode }) {
  useEffect(() => {

    const requestFullscreen = async () => {
      try {
        if (document.documentElement.requestFullscreen) {
          await document.documentElement.requestFullscreen();
        }
      } catch (error) {
        console.warn("Fullscreen request was denied.", error);
      }
    };
    
    requestFullscreen();

    const handleCopy = (e: ClipboardEvent) => {
      e.preventDefault();
      alert('Copying is disabled for this exam.');
    };

    const handleCut = (e: ClipboardEvent) => {
      e.preventDefault();
      alert('Cutting is disabled for this exam.');
    };
    
    const handlePaste = (e: ClipboardEvent) => {
      e.preventDefault();
      alert('Pasting is disabled for this exam.');
    };

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      alert('Right-clicking is disabled for this exam.');
    };

    const handleKeyDown = (e: KeyboardEvent) => {
        // Block Print Screen, F12, Ctrl+Shift+I, etc.
        if (e.key === 'PrintScreen' || (e.key === 'F12') || (e.ctrlKey && e.shiftKey && e.key === 'I') || (e.ctrlKey && e.shiftKey && e.key === 'J') || (e.ctrlKey && e.key === 'U') || (e.metaKey && e.altKey && e.key === 'i')) {
            e.preventDefault();
            alert('This action is disabled for the exam.');
        }
    }
    
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) {
        console.log("Exited fullscreen mode.");
        // Optionally, alert the user or submit the exam automatically.
        // For now, we will attempt to re-enter fullscreen.
        requestFullscreen();
      }
    };


    document.addEventListener('copy', handleCopy);
    document.addEventListener('cut', handleCut);
    document.addEventListener('paste', handlePaste);
    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('fullscreenchange', handleFullscreenChange);

    return () => {
      document.removeEventListener('copy', handleCopy);
      document.removeEventListener('cut', handleCut);
      document.removeEventListener('paste', handlePaste);
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
       if (document.fullscreenElement) {
        document.exitFullscreen();
      }
    };
  }, []);

  return <>{children}</>;
}
