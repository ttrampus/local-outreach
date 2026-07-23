// A real, working contact form for the generated site. The deployed site is a
// static file, so the form can't have its own backend — it POSTs (cross-origin)
// back to THIS app at /api/site/:leadId/contact, which stores the message and
// emails the owner. This is what turns the mockup into something worth €50/month:
// the owner actually receives enquiries from it.
//
// The site engine places a {{CONTACT_FORM}} token in its contact section; we swap
// in this self-contained markup (scoped styles + inline fetch handler). If the
// engine omitted the token, the caller appends the form before </body> instead.
import { env } from "@/lib/env";
import type { Locale } from "./i18n";

export const CONTACT_FORM_TOKEN = "{{CONTACT_FORM}}";

interface Strings {
  heading: string;
  name: string;
  email: string;
  message: string;
  send: string;
  sending: string;
  thanks: string;
  error: string;
}

const SL: Strings = {
  heading: "Pišite nam",
  name: "Ime",
  email: "E-pošta",
  message: "Sporočilo",
  send: "Pošlji",
  sending: "Pošiljanje…",
  thanks: "Hvala! Sporočilo je bilo poslano.",
  error: "Sporočila ni bilo mogoče poslati. Poskusite znova.",
};

const EN: Strings = {
  heading: "Get in touch",
  name: "Name",
  email: "Email",
  message: "Message",
  send: "Send",
  sending: "Sending…",
  thanks: "Thanks! Your message has been sent.",
  error: "Could not send your message. Please try again.",
};

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Self-contained, design-neutral contact form that posts back to this app. */
export function renderContactForm(leadId: string, locale: Locale): string {
  const t = locale === "sl" ? SL : EN;
  const action = `${env.appBaseUrl}/api/site/${esc(leadId)}/contact`;

  return `
<div class="__lo-cf" data-action="${action}">
  <style>
    .__lo-cf{max-width:560px;margin:32px auto;padding:24px;border:1px solid currentColor;
      border-radius:14px;opacity:.96;font-family:inherit;}
    .__lo-cf h3{margin:0 0 16px;font:inherit;font-size:1.4em;font-weight:700;}
    .__lo-cf label{display:block;font-size:.8em;text-transform:uppercase;letter-spacing:.08em;
      opacity:.7;margin:12px 0 4px;}
    .__lo-cf input,.__lo-cf textarea{width:100%;box-sizing:border-box;padding:11px 13px;
      border:1px solid currentColor;border-radius:9px;background:transparent;color:inherit;
      font:inherit;font-size:1em;opacity:.95;}
    .__lo-cf textarea{min-height:120px;resize:vertical;}
    .__lo-cf button{margin-top:16px;width:100%;padding:13px;border:0;border-radius:9px;
      background:currentColor;font:inherit;font-weight:700;font-size:1em;cursor:pointer;}
    .__lo-cf button span{filter:invert(1);mix-blend-mode:difference;}
    .__lo-cf .__lo-cf-msg{margin-top:14px;font-size:.95em;}
    .__lo-cf[data-done="1"] form{display:none;}
    .__lo-cf[data-done="1"] .__lo-cf-msg{display:block;}
  </style>
  <h3>${esc(t.heading)}</h3>
  <form>
    <label>${esc(t.name)}</label>
    <input name="name" type="text" autocomplete="name" required />
    <label>${esc(t.email)}</label>
    <input name="email" type="email" autocomplete="email" required />
    <label>${esc(t.message)}</label>
    <textarea name="message" required></textarea>
    <button type="submit"><span>${esc(t.send)}</span></button>
    <div class="__lo-cf-msg" style="display:none"></div>
  </form>
  <div class="__lo-cf-msg" data-thanks style="display:none">${esc(t.thanks)}</div>
</div>
<script>
(function(){
  var root=document.currentScript.previousElementSibling;
  if(!root||!root.classList.contains("__lo-cf"))return;
  var form=root.querySelector("form"),btn=root.querySelector("button span"),
      inlineMsg=form.querySelector(".__lo-cf-msg");
  var L=${JSON.stringify({ sending: t.sending, send: t.send, error: t.error })};
  form.addEventListener("submit",function(e){
    e.preventDefault();
    var data={name:form.name.value,email:form.email.value,message:form.message.value};
    btn.textContent=L.sending;
    fetch(root.getAttribute("data-action"),{method:"POST",headers:{"Content-Type":"application/json"},
      body:JSON.stringify(data)})
      .then(function(r){if(!r.ok)throw 0;root.setAttribute("data-done","1");})
      .catch(function(){inlineMsg.style.display="block";inlineMsg.textContent=L.error;btn.textContent=L.send;});
  });
})();
</script>`;
}

/**
 * Put the working form into the site HTML: replace the {{CONTACT_FORM}} token the
 * engine placed in its contact section, or — if it omitted the token — append the
 * form before </body> so the deployed site always has a functioning enquiry form.
 */
export function injectContactForm(html: string, leadId: string, locale: Locale): string {
  const form = renderContactForm(leadId, locale);
  if (html.includes(CONTACT_FORM_TOKEN)) {
    return html.split(CONTACT_FORM_TOKEN).join(form);
  }
  return html.includes("</body>") ? html.replace("</body>", `${form}\n</body>`) : html + form;
}
