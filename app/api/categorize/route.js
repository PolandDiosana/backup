import { NextResponse } from 'next/server';

const CATEGORY_MAP = {
  Images: ['.jpg', '.jpeg', '.png', '.gif', '.svg', '.webp', '.ico', '.bmp'],
  Documents: ['.pdf', '.doc', '.docx', '.txt', '.rtf', '.csv', '.xls', '.xlsx', '.ppt', '.pptx'],
  Code: ['.js', '.jsx', '.ts', '.tsx', '.json', '.html', '.css', '.scss', '.md', '.py', '.java', '.c', '.cpp', '.cs'],
  Media: ['.mp4', '.avi', '.mkv', '.mov', '.wmv', '.mp3', '.wav', '.flac', '.ogg'],
  Archives: ['.zip', '.rar', '.tar', '.gz', '.7z'],
};

function getCategoryForExt(ext) {
  const normalizedExt = ext.toLowerCase();
  for (const [category, extensions] of Object.entries(CATEGORY_MAP)) {
    if (extensions.includes(normalizedExt)) {
      return category;
    }
  }
  return 'Other';
}

export async function POST(request) {
  try {
    const { files } = await request.json();

    if (!files || !Array.isArray(files)) {
      return NextResponse.json({ error: 'Invalid files payload' }, { status: 400 });
    }

    const categorizedFiles = files.map((file) => {
      // file object has { name, path } generally, but we just need the filename.
      const name = file.name || file;
      const lastDotIndex = name.lastIndexOf('.');
      
      let ext = '';
      if (lastDotIndex > 0) { // ignoring hidden files like .gitignore
        ext = name.substring(lastDotIndex);
      }
      
      let category = 'Other';
      if (ext) {
        category = getCategoryForExt(ext);
      } else {
        category = 'Folders/Unknown'; // if no extension
      }

      return {
        originalPath: file.path || name,
        name: name,
        category: category,
        newPath: `${category}/${name}`
      };
    });

    return NextResponse.json({ categorized: categorizedFiles }, { status: 200 });
  } catch (error) {
    console.error('Categorize API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
