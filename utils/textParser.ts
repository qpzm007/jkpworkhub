/**
 * Editor.js JSON 블록 형식의 문자열 또는 레거시 HTML/일반 텍스트 문자열을 파싱하여
 * 검색 및 요약 렌더링에 적합한 일반 텍스트(Plain Text)로 반환합니다.
 */
export function getPlainDesc(jsonStr: string | null): string {
  if (!jsonStr) return '';
  const trimmed = jsonStr.trim();
  
  if (trimmed.startsWith('{') && trimmed.includes('"blocks"')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed.blocks && Array.isArray(parsed.blocks)) {
        return parsed.blocks
          .map((block: any) => {
            if (block.data && block.data.text) {
              // HTML 태그 제거 (예: <b>, <i>, <a> 등)
              return block.data.text.replace(/<\/?[^>]+(>|$)/g, '');
            }
            if (block.data && block.data.items && Array.isArray(block.data.items)) {
              // 리스트 및 체크리스트의 항목들 결합
              return block.data.items
                .map((item: any) => {
                  const text = typeof item === 'object' ? item.text : item;
                  return text ? text.replace(/<\/?[^>]+(>|$)/g, '') : '';
                })
                .join(' ');
            }
            return '';
          })
          .filter(Boolean)
          .join(' ');
      }
    } catch (e) {
      // 파싱 실패 시 원본 문자열 반환
      return jsonStr;
    }
  }
  return jsonStr;
}
