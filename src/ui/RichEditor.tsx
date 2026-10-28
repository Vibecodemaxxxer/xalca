import { mergeAttributes } from '@tiptap/core';
import Image from '@tiptap/extension-image';
import { TaskItem, TaskList } from '@tiptap/extension-list';
import { Placeholder } from '@tiptap/extensions';
import { Markdown } from '@tiptap/markdown';
import { EditorContent, NodeViewWrapper, ReactNodeViewRenderer, useEditor, useEditorState, type Editor, type NodeViewProps } from '@tiptap/react';
import { BubbleMenu } from '@tiptap/react/menus';
import StarterKit from '@tiptap/starter-kit';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { tr } from '../i18n/lang';
import { addImage, IMG_PREFIX, imageUrl } from '../sync/images';

// Визуальный редактор как в Notion: текст сразу оформлен, символов markdown не видно.
// Хранится по-прежнему markdown — старые описания и синхронизация не меняются.

/** Картинка ![](img:<hash>) — показываем из локального хранилища или Dropbox. */
function StoredImageView({ node }: NodeViewProps) {
  const src = String(node.attrs.src ?? '');
  const [url, setUrl] = useState<string | null | undefined>(src.startsWith(IMG_PREFIX) ? undefined : src);
  useEffect(() => {
    if (!src.startsWith(IMG_PREFIX)) return;
    let alive = true;
    void imageUrl(src.slice(IMG_PREFIX.length)).then((u) => alive && setUrl(u));
    return () => {
      alive = false;
    };
  }, [src]);
  return (
    <NodeViewWrapper as="span" className="re-img">
      {url === undefined ? <span className="img-ph">…</span> : url === null ? <span className="img-ph">картинка ещё не загружена</span> : <img src={url} alt={node.attrs.alt ?? ''} draggable={false} />}
    </NodeViewWrapper>
  );
}

const StoredImage = Image.extend({
  addNodeView() {
    return ReactNodeViewRenderer(StoredImageView);
  },
  // В HTML (копирование, служебная разметка) не отдаём src вида img:… — браузер попытался бы его загрузить.
  renderHTML({ HTMLAttributes }) {
    const src = String(HTMLAttributes.src ?? '');
    return ['img', mergeAttributes(HTMLAttributes, src.startsWith(IMG_PREFIX) ? { src: null, 'data-xalca-img': src } : {})];
  },
}).configure({ inline: false, allowBase64: false });

async function insertImages(editor: Editor, files: File[]) {
  for (const f of files) {
    if (!f.type.startsWith('image/')) continue;
    const hash = await addImage(f);
    editor.chain().focus().setImage({ src: `${IMG_PREFIX}${hash}` }).run();
  }
}

export function RichEditor({ value, onChange, placeholder, autoFocus }: { value: string; onChange: (md: string) => void; placeholder?: string; autoFocus?: boolean }) {
  const last = useRef(value);
  const file = useRef<HTMLInputElement>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ link: { openOnClick: false, autolink: true, defaultProtocol: 'https' }, heading: { levels: [1, 2, 3] } }),
      TaskList,
      TaskItem.configure({ nested: true }),
      StoredImage,
      Placeholder.configure({ placeholder: placeholder ?? tr('Qeyd əlavə et…', 'Добавить заметку…') }),
      Markdown,
    ],
    content: value,
    contentType: 'markdown',
    autofocus: autoFocus ? 'end' : false,
    onUpdate: ({ editor }) => {
      const md = editor.getMarkdown();
      last.current = md;
      onChange(md);
    },
    editorProps: {
      handlePaste: (_view, event) => {
        const files = [...(event.clipboardData?.files ?? [])].filter((f) => f.type.startsWith('image/'));
        if (!files.length || !editor) return false;
        void insertImages(editor, files);
        return true;
      },
      handleDrop: (_view, event) => {
        const files = [...((event as DragEvent).dataTransfer?.files ?? [])].filter((f) => f.type.startsWith('image/'));
        if (!files.length || !editor) return false;
        event.preventDefault();
        void insertImages(editor, files);
        return true;
      },
    },
  });

  // Текст поменялся снаружи (например, пришёл синк) — обновляем, если пользователь сейчас не печатает.
  useEffect(() => {
    if (!editor || value === last.current || editor.isFocused) return;
    last.current = value;
    editor.commands.setContent(value, { contentType: 'markdown', emitUpdate: false });
  }, [value, editor]);

  if (!editor) return null;

  return (
    <div className="re">
      <Toolbar editor={editor} onImage={() => file.current?.click()} />
      <BubbleMenu editor={editor} className="re-bubble" shouldShow={({ editor, from, to }) => from !== to && !editor.isActive('image')}>
        <Marks editor={editor} />
      </BubbleMenu>
      <EditorContent editor={editor} className="re-content md" />
      <input
        ref={file}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => {
          void insertImages(editor, [...(e.target.files ?? [])]);
          e.target.value = '';
        }}
      />
    </div>
  );
}

function Btn({ on, label, onClick, children }: { on?: boolean; label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      className={on ? 'on' : ''}
      title={label}
      aria-label={label}
      // не забираем фокус у редактора
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function useActive(editor: Editor) {
  return useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e.isActive('bold'),
      italic: e.isActive('italic'),
      strike: e.isActive('strike'),
      code: e.isActive('code'),
      link: e.isActive('link'),
      h1: e.isActive('heading', { level: 1 }),
      h2: e.isActive('heading', { level: 2 }),
      h3: e.isActive('heading', { level: 3 }),
      bullet: e.isActive('bulletList'),
      ordered: e.isActive('orderedList'),
      task: e.isActive('taskList'),
      quote: e.isActive('blockquote'),
    }),
  });
}

function setLink(editor: Editor) {
  const prev = editor.getAttributes('link').href as string | undefined;
  const url = prompt('Ссылка (пусто — убрать)', prev ?? 'https://');
  if (url === null) return;
  if (!url.trim() || url === 'https://') editor.chain().focus().extendMarkRange('link').unsetLink().run();
  else editor.chain().focus().extendMarkRange('link').setLink({ href: url.trim() }).run();
}

function Marks({ editor }: { editor: Editor }) {
  const a = useActive(editor);
  return (
    <>
      <Btn on={a.bold} label="Жирный (Ctrl+B)" onClick={() => editor.chain().focus().toggleBold().run()}>
        <b>B</b>
      </Btn>
      <Btn on={a.italic} label="Курсив (Ctrl+I)" onClick={() => editor.chain().focus().toggleItalic().run()}>
        <i style={{ fontFamily: 'Georgia, serif' }}>I</i>
      </Btn>
      <Btn on={a.strike} label="Зачёркнутый" onClick={() => editor.chain().focus().toggleStrike().run()}>
        <s>S</s>
      </Btn>
      <Btn on={a.code} label="Код" onClick={() => editor.chain().focus().toggleCode().run()}>
        {'</>'}
      </Btn>
      <Btn on={a.link} label="Ссылка" onClick={() => setLink(editor)}>
        {I.link}
      </Btn>
    </>
  );
}

function Toolbar({ editor, onImage }: { editor: Editor; onImage: () => void }) {
  const a = useActive(editor);
  const c = () => editor.chain().focus();
  return (
    <div className="re-toolbar" role="toolbar" aria-label="Форматирование">
      <Marks editor={editor} />
      <span className="re-sep" />
      <Btn on={a.h1} label="Заголовок 1" onClick={() => c().toggleHeading({ level: 1 }).run()}>
        H1
      </Btn>
      <Btn on={a.h2} label="Заголовок 2" onClick={() => c().toggleHeading({ level: 2 }).run()}>
        H2
      </Btn>
      <Btn on={a.h3} label="Заголовок 3" onClick={() => c().toggleHeading({ level: 3 }).run()}>
        H3
      </Btn>
      <span className="re-sep" />
      <Btn on={a.bullet} label="Список" onClick={() => c().toggleBulletList().run()}>
        {I.bullet}
      </Btn>
      <Btn on={a.ordered} label="Нумерованный список" onClick={() => c().toggleOrderedList().run()}>
        {I.ordered}
      </Btn>
      <Btn on={a.task} label="Чек-лист" onClick={() => c().toggleTaskList().run()}>
        {I.task}
      </Btn>
      <Btn on={a.quote} label="Цитата" onClick={() => c().toggleBlockquote().run()}>
        {I.quote}
      </Btn>
      <Btn label="Картинка" onClick={onImage}>
        {I.image}
      </Btn>
    </div>
  );
}

const ico = (d: ReactNode) => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
    {d}
  </svg>
);
const I = {
  bullet: ico(<><circle cx="5" cy="7" r="1.3" fill="currentColor" /><circle cx="5" cy="12" r="1.3" fill="currentColor" /><circle cx="5" cy="17" r="1.3" fill="currentColor" /><path d="M10 7h10M10 12h10M10 17h10" /></>),
  ordered: ico(<><path d="M10 7h10M10 12h10M10 17h10" /><path d="M4 5.5h1.5V9M4 9h3M4 14.5c.5-.8 2.8-.8 2.8.6 0 1.2-2.8 1.6-2.8 3h3" strokeWidth={1.6} /></>),
  task: ico(<><rect x="3.5" y="4.5" width="6" height="6" rx="1.5" /><path d="M5 7.6l1.2 1.2 2-2.2M13 7.5h7.5M3.5 15.5h6v4.5h-6zM13 17.5h7.5" /></>),
  quote: ico(<path d="M6 17c-1.5 0-2.5-1.2-2.5-3 0-3.5 2.5-6 5.5-7M15 17c-1.5 0-2.5-1.2-2.5-3 0-3.5 2.5-6 5.5-7" />),
  image: ico(<><rect x="3.5" y="4.5" width="17" height="15" rx="2.5" /><circle cx="9" cy="10" r="1.6" /><path d="M20.5 16l-5-5-8.5 8.5" /></>),
  link: ico(<><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" /><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" /></>),
};
