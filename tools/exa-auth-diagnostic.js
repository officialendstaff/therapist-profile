// EXA authentication diagnostic (read-only; no credentials/cookie values are read or transmitted).
(async () => {
  const allDocs = [document];
  for (let i = 0; i < allDocs.length; i++) {
    for (const frame of allDocs[i].querySelectorAll("iframe")) {
      try { if (frame.contentDocument) allDocs.push(frame.contentDocument); } catch {}
    }
  }
  const doc = allDocs.find(d => d.querySelector('input[name$="[status]"]')) || document;
  if (doc.location.origin !== "https://rose-gentleman.com") {
    alert("薔薇と紳士のEXA日別スケジュール上で実行してください");
    return;
  }
  const probe = async pathname => {
    try {
      const url = new URL(pathname, doc.location.origin);
      const response = await doc.defaultView.fetch(url, {
        method:"GET",credentials:"include",redirect:"follow",cache:"no-store"
      });
      if (new URL(response.url).origin !== doc.location.origin)
        return { path:pathname,status:response.status,crossOriginRedirect:true };
      const html = await response.text();
      const parsed = new DOMParser().parseFromString(html, "text/html");
      const forms = [...parsed.querySelectorAll("form")].map(f => ({
        method:(f.getAttribute("method")||"GET").toUpperCase(),
        actionPath:(() => {try{return new URL(f.getAttribute("action")||response.url,response.url).pathname}catch{return "invalid"}})(),
        passwordFieldPresent:!!f.querySelector('input[type="password"]'),
        hiddenFieldNames:[...f.querySelectorAll('input[type="hidden"][name]')]
          .map(x=>x.name).filter(x=>!/password|passwd|secret|token|session|csrf|auth|key|code/i.test(x)).slice(0,12),
        securityFieldsPresent:[...f.querySelectorAll('input[type="hidden"][name]')]
          .some(x=>/csrf|token|nonce|authenticity/i.test(x.name))
      }));
      return {path:pathname,status:response.status,redirected:response.redirected,
        finalPath:new URL(response.url).pathname,
        passwordFormPresent:forms.some(f=>f.passwordFieldPresent),
        forms:forms.slice(0,4)};
    } catch(error) {return {path:pathname,error:String(error?.message||error)};}
  };
  const report = {
    date:new Date().toISOString().slice(0,10),
    currentPagePath:doc.location.pathname,
    scheduleInputsPresent:!!doc.querySelector('input[name$="[status]"]'),
    pages:await Promise.all([
      probe("/exa/member/"),
      probe("/exa/member/top.php")
    ])
  };
  console.log("EXA AUTH DIAGNOSTIC — NO SECRETS",report);
  const output=JSON.stringify(report,null,2);
  console.log(output);
  try {await navigator.clipboard.writeText(output);
    alert("認証方式の診断が完了しました。結果をコピーしました。ChatGPTに貼り付けてください。");
  } catch {alert("認証方式の診断が完了しました。Consoleの結果をコピーしてください。");}
})();
