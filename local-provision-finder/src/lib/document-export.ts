import type { CustomerDocument } from './meeting';
function download(blob: Blob, filename: string) {
  const url=URL.createObjectURL(blob);const anchor=document.createElement('a');anchor.href=url;anchor.download=filename;document.body.appendChild(anchor);anchor.click();anchor.remove();window.setTimeout(()=>URL.revokeObjectURL(url),10000);
}
export function documentSections(document: CustomerDocument) {
  return [{title:document.title,text:[document.customer && `Prepared for ${document.customer}`,document.date].filter(Boolean).join('\n')},{title:'What we discussed',text:document.summary},{title:'Provision to explore',text:document.provisions},{title:'Your next steps',text:document.nextSteps}];
}
export async function exportDocument(format: 'pdf'|'docx'|'png', document: CustomerDocument, node: HTMLElement) {
  const filename='customer-meeting-summary';
  if (format==='docx') {
    const {Document,Paragraph,Packer,HeadingLevel}=await import('docx');
    const file=new Document({sections:[{children:documentSections(document).flatMap((section,index)=>[
      new Paragraph({text:section.title,heading:index===0 ? HeadingLevel.TITLE : HeadingLevel.HEADING_1}),
      ...section.text.split('\n').map(text=>new Paragraph({text,spacing:{after:140}})),
    ])}]});
    download(await Packer.toBlob(file),`${filename}.docx`);
  } else if (format==='pdf') {
    const {jsPDF}=await import('jspdf');const pdf=new jsPDF({unit:'mm',format:'a4'});let y=24;
    for (const [index,section] of documentSections(document).entries()) {
      for (const [heading,text] of [[true,section.title],[false,section.text]] as const) {
        pdf.setFont('helvetica',heading ? 'bold' : 'normal');pdf.setFontSize(heading ? (index===0 ? 23 : 15) : 11);
        pdf.setTextColor('#0b0c0c');
        const lineHeight=heading ? 9 : 6;
        const safe=text.replace(/[“”]/g,'"').replace(/[‘’]/g,"'").replace(/[–—]/g,'-');
        const lines=pdf.splitTextToSize(safe,162) as string[];
        for (const line of lines) {if(y+lineHeight>274){pdf.addPage();y=24;}pdf.text(line,24,y);y+=lineHeight;}
        y+=heading ? 2 : 7;
      }
    }
    pdf.save(`${filename}.pdf`);
  } else {
    const {toBlob}=await import('html-to-image');await window.document.fonts.ready;
    const blob=await toBlob(node,{pixelRatio:2,backgroundColor:'#ffffff',width:794,height:node.scrollHeight,style:{position:'static',left:'auto',top:'auto',transform:'none',width:'794px',height:'auto',maxWidth:'none'},skipFonts:true});
    if(!blob) throw new Error('Image export failed.');download(blob,`${filename}.png`);
  }
}
