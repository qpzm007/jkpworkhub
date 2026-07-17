'use client';

import { useEffect, useRef } from 'react';

interface RichEditorProps {
  data: string; // JSON String
  onChange: (dataStr: string) => void;
  readOnly?: boolean;
}

export default function RichEditor({ data, onChange, readOnly = false }: RichEditorProps) {
  const editorRef = useRef<any>(null);
  const containerId = 'editorjs-container';

  useEffect(() => {
    if (typeof window === 'undefined') return;

    let isMounted = true;

    const initEditor = async () => {
      // @ts-ignore
      const EditorJS = (await import('@editorjs/editorjs')).default;
      // @ts-ignore
      const Header = (await import('@editorjs/header')).default;
      // @ts-ignore
      const List = (await import('@editorjs/list')).default;
      // @ts-ignore
      const Checklist = (await import('@editorjs/checklist')).default;

      let parsedData: any = undefined;
      if (data) {
        try {
          parsedData = JSON.parse(data);
        } catch (e) {
          // 레거시 일반 텍스트의 경우 문단 블록으로 래핑
          parsedData = {
            blocks: [{ type: 'paragraph', data: { text: data } }],
          };
        }
      }

      if (!isMounted) return;

      const editor = new EditorJS({
        holder: containerId,
        readOnly: readOnly,
        placeholder: readOnly ? '상세 설명이 비어있습니다.' : '업무 관련 상세 내용이나 체크리스트를 노션처럼 자유롭게 기록하세요...',
        data: parsedData,
        tools: {
          header: {
            class: Header as any,
            inlineToolbar: true,
          },
          list: {
            class: List as any,
            inlineToolbar: true,
          },
          checklist: {
            class: Checklist as any,
            inlineToolbar: true,
          },
        },
        async onChange() {
          if (readOnly) return;
          const savedData = await editor.save();
          onChange(JSON.stringify(savedData));
        },
      });

      editorRef.current = editor;
    };

    initEditor();

    return () => {
      isMounted = false;
      if (editorRef.current && typeof editorRef.current.destroy === 'function') {
        try {
          editorRef.current.destroy();
        } catch (e) {
          // 무시
        }
      }
    };
  }, [readOnly]); // readOnly 설정이 바뀔 때만 재시작

  return (
    <div
      id={containerId}
      className="prose max-w-none border border-slate-200 rounded-xl p-5 min-h-[300px] bg-white shadow-sm outline-none focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent transition-all"
    />
  );
}
