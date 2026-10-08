import type { Metadata } from "next";
import { Outfit } from "next/font/google";
import "./globals.css";

const outfit = Outfit({ subsets: ["latin"], variable: "--font-outfit" });

export const metadata: Metadata = {
  title: "Newton Property",
  description: "Newton Property broker desk.",
};

const stripExtensionAttrs = `(function(){
  var extra=/^(bis_|__processed_)/;
  function clean(node){
    if(!node||node.nodeType!==1||!node.attributes)return;
    for(var i=node.attributes.length-1;i>=0;i--){
      if(extra.test(node.attributes[i].name))node.removeAttribute(node.attributes[i].name);
    }
  }
  function sweep(root){
    clean(root);
    if(!root.querySelectorAll)return;
    var all=root.querySelectorAll("*");
    for(var i=0;i<all.length;i++)clean(all[i]);
  }
  sweep(document.documentElement);
  var observer=new MutationObserver(function(records){
    for(var i=0;i<records.length;i++){
      var record=records[i];
      if(record.type==="attributes")clean(record.target);
      var nodes=record.addedNodes||[];
      for(var j=0;j<nodes.length;j++)sweep(nodes[j]);
    }
  });
  observer.observe(document.documentElement,{attributes:true,childList:true,subtree:true});
  setTimeout(function(){observer.disconnect();},5000);
})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${outfit.className} antialiased`} suppressHydrationWarning>
        <script dangerouslySetInnerHTML={{ __html: stripExtensionAttrs }} />
        {children}
      </body>
    </html>
  );
}
