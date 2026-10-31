# Policy / trust pages (English = authoritative; short Hindi summaries for students). Edit EMAIL/GRIEVANCE in common.py if they change.
from common import page, EMAIL, UPDATED

IG = '<a href="https://instagram.com/bhupesh_jatav_02" rel="noopener">@bhupesh_jatav_02</a>'
MAIL = f'<a href="mailto:{EMAIL}">{EMAIL}</a>'

PRIVACY = f'''
<p>This Privacy Policy explains how EduSpark (&ldquo;EduSpark&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;) collects, uses, shares and protects personal data when you use <a href="https://eduspark.live/">eduspark.live</a> and the EduSpark web app (together, the &ldquo;Service&rdquo;). By using the Service and ticking the consent checkbox on the login page you agree to this policy. If you do not agree, please do not use the Service.</p>

<h2>1. Who we are</h2>
<p>EduSpark is an independent, free study app for students preparing for CBSE and BSER (RBSE) Class 10/12 examinations and competitive exams such as SSC, REET and BSTC. It is built and operated by Bhupesh from Jaipur, Rajasthan, India, who is the data fiduciary (controller) for the personal data described here. Contact details are in Section 14.</p>

<h2>2. Information we collect</h2>
<h3>Information you give us</h3>
<ul>
<li><strong>Profile:</strong> name, username, profile photo and the board/class you select.</li>
<li><strong>Google Sign-In:</strong> if you sign in with Google, we receive your Google account name, email address, profile photo and unique user ID through Firebase Authentication. We never receive your Google password.</li>
<li><strong>Doubts and messages:</strong> the questions you submit (with subject, topic and board) and anything you send to us by email, WhatsApp or Instagram.</li>
</ul>
<h3>Information collected automatically</h3>
<ul>
<li><strong>Device and activity data:</strong> a randomly generated device ID, the time you were last active, and your selected board.</li>
<li><strong>Push notification token:</strong> only if you allow notifications.</li>
<li><strong>Crash reports:</strong> technical error information (browser/phone type, error message) sent to Sentry after you accept the checkbox. These do not include your name or email.</li>
<li><strong>Advertising identifiers and cookies:</strong> if ads are shown, Google AdSense may set cookies or use device identifiers (see Section 6).</li>
</ul>
<h3>Information stored on your device</h3>
<p>Study progress, settings, offline copies of content you opened (browser cache and IndexedDB) and a record of the policy version you accepted are stored on your device. You can clear them from your browser settings.</p>
<p>We do <strong>not</strong> collect your phone number, home address, government ID, precise location or payment details through the app.</p>

<h2>3. Why we use your information</h2>
<ul>
<li>To provide the Service: show study content and quizzes, save your profile and progress, and show your doubts and answers.</li>
<li>To send study reminders and announcements (up to about three reminders a day, plus occasional announcements and offers) if you enable notifications.</li>
<li>To answer your doubts, including AI-generated answers when you request them.</li>
<li>To keep the Service secure, prevent abuse, fix errors and improve features.</li>
<li>To show advertising that supports the free Service.</li>
<li>To respond to your requests and comply with the law.</li>
</ul>
<p>We process personal data on the basis of your consent and, where the law permits, for other lawful purposes. You can withdraw consent at any time (Section 10).</p>

<h2>4. Notifications</h2>
<p>If you allow notifications, we store a push token so that Firebase Cloud Messaging can deliver reminders to your device. You can stop notifications at any time in your browser or phone settings, or by deleting your account. Delivery depends on your device, browser, battery-saver settings and internet connection, so we cannot guarantee that every notification arrives at an exact time.</p>

<h2>5. Crash reports and analytics</h2>
<p>Crash reports (Sentry) start only after you tick the consent checkbox. Usage analytics (Firebase Analytics) and screen-interaction recordings (Microsoft Clarity) are currently switched off. Before we ever turn them on, we will ask for a separate permission, and only for users aged 18 or above.</p>

<h2>6. Advertising (Google AdSense)</h2>
<p>EduSpark uses Google AdSense and ads may be shown on some pages. Third-party vendors, including Google, use cookies or device identifiers to serve ads based on a user&rsquo;s previous visits to this website or other websites. Google&rsquo;s use of advertising cookies enables it and its partners to serve ads to you based on your visit to EduSpark and/or other sites on the internet.</p>
<ul>
<li>You can opt out of personalised advertising at <a href="https://adssettings.google.com" rel="noopener">Google Ads Settings</a>.</li>
<li>You can opt out of some third-party vendors&rsquo; use of cookies for personalised advertising at <a href="https://www.aboutads.info" rel="noopener">aboutads.info</a>.</li>
<li>To learn how Google uses data from sites that use its services, see <a href="https://policies.google.com/technologies/partner-sites" rel="noopener">policies.google.com/technologies/partner-sites</a>.</li>
</ul>
<p>Because many of our users are under 18 and we cannot reliably verify age, we configure ad requests for restricted data processing and non-personalised advertising wherever the ad platform allows it, and we do not intentionally show personalised or interest-based ads to children. For visitors in the European Economic Area, the United Kingdom and Switzerland, ads are shown only in line with Google&rsquo;s consent requirements. See also our <a href="/ads-and-cookies.html">Ads &amp; Cookies</a> page.</p>

<h2>7. Who we share data with</h2>
<p>We do not sell your personal data. We share it only with service providers that help us run the Service, and only as needed:</p>
<ul>
<li><strong>Google Firebase</strong> (Authentication, Cloud Firestore database, Cloud Messaging for notifications).</li>
<li><strong>Google AdSense</strong> (advertising, see Section 6).</li>
<li><strong>Cloudflare</strong> (hosting of our background server and, for the AI doubt solver, relaying your question to a Google AI model). Do not include personal details such as phone numbers or addresses in a doubt. AI answers may be inaccurate.</li>
<li><strong>ImageKit</strong> (delivers quiz images).</li>
<li><strong>Sentry</strong> (crash reports, after you consent).</li>
<li><strong>UptimeRobot</strong> (checks that the site is online; it receives no information about individual users).</li>
<li><strong>GitHub</strong> (hosts the website files).</li>
</ul>
<p>We may also disclose information when required by law, court order or a lawful government request, or to protect the rights, safety and security of our users and the Service. Each provider processes data under its own privacy policy.</p>

<h2>8. International transfers</h2>
<p>Firebase, Cloudflare and other providers may process data on servers outside India. By using the Service you understand that your data may be transferred and processed in other countries, subject to the safeguards of those providers and applicable law.</p>

<h2>9. How long we keep data</h2>
<p>We keep profile, device and notification data for as long as your account exists or until you delete it. Doubts are kept until you or an administrator delete them. After you delete your account the data listed in Section 2 is removed from our database; backups and logs held by providers are overwritten on their normal schedules. Crash data sent to Sentry is kept under Sentry&rsquo;s retention rules and is not linked to your name by us.</p>

<h2>10. Your rights and choices</h2>
<ul>
<li><strong>Access and correction:</strong> view and edit your profile on the Profile page.</li>
<li><strong>Erasure:</strong> use Profile &rarr; &ldquo;Delete account and data&rdquo; in the app. If you cannot open the app, follow the steps on our <a href="/delete-account.html">Account Deletion</a> page.</li>
<li><strong>Withdraw consent:</strong> log out from the Profile page; the consent checkbox will be shown again at your next login. You may also turn off notifications in your device settings.</li>
<li><strong>Ads:</strong> opt out of personalised ads using the links in Section 6.</li>
<li><strong>Grievance:</strong> contact our grievance contact in Section 14. You also have the right to nominate another person to exercise your rights in case of death or incapacity, and to complain to the Data Protection Board of India once it is operational.</li>
</ul>

<h2>11. Children and students</h2>
<p>EduSpark is made for students, and many are under 18. Under Indian law (the Digital Personal Data Protection Act, 2023 and the rules made under it) a person under 18 is a &ldquo;child&rdquo;. We therefore:</p>
<ul>
<li>ask users under 18 to use the Service and Google Sign-In only with the knowledge and permission of a parent or guardian;</li>
<li>keep usage analytics and screen recordings off for users under 18, and do not track or profile children&rsquo;s behaviour for advertising;</li>
<li>do not intentionally show personalised advertising to children;</li>
<li>collect only the data the Service needs, and delete it on request.</li>
</ul>
<p>Parents or guardians who believe a child has provided data without permission can email us to have it removed. We will introduce verifiable parental-consent steps as required by the rules when they come into force.</p>

<h2>12. Security</h2>
<p>Data is stored in Google Firebase with access rules, and traffic is sent over HTTPS. Administrator access is restricted to a verified account. No online system is completely secure, so please protect your Google account and report any security issue to us.</p>

<h2>13. Links and changes</h2>
<p>The Service may link to third-party websites (for example official exam websites or offers). We are not responsible for their content or privacy practices. If we change this policy, we will update this page and the date above; for material changes the app may ask for your consent again.</p>

<h2>14. Contact and grievance officer</h2>
<p><strong>Grievance contact:</strong> Bhupesh, EduSpark, Jaipur, Rajasthan, India.<br>
Email: {MAIL}<br>
Instagram: {IG}<br>
Phone/WhatsApp: <a href="tel:+918094120884">+91 80941 20884</a></p>
<p>For privacy questions, deletion requests, copyright notices and complaints, write to us. We aim to reply within 7 days and to resolve complaints within 30 days.</p>
'''
PRIVACY_HI = ('<strong>हिंदी सारांश:</strong> EduSpark आपका नाम, username, board, Google account की जानकारी (अगर Google से login करें), doubts और notification token सेव करता है। '
 'हम आपका data बेचते नहीं हैं। Ads (Google AdSense) दिख सकते हैं; 18 साल से कम उम्र के users को हम personalised ads नहीं दिखाते। '
 'आप Profile से अपना account और data कभी भी delete कर सकते हैं। पूरी और बाध्यकारी policy नीचे English में है।')

TERMS = f'''
<p>These Terms of Use (&ldquo;Terms&rdquo;) are a legal agreement between you and EduSpark (&ldquo;EduSpark&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;) for the use of <a href="https://eduspark.live/">eduspark.live</a> and the EduSpark web app (the &ldquo;Service&rdquo;). Please read them together with our <a href="/privacy.html">Privacy Policy</a>, <a href="/disclaimer.html">Disclaimer</a> and <a href="/ads-and-cookies.html">Ads &amp; Cookies</a> page. By accessing or using the Service you agree to be bound by these Terms. If you do not agree, do not use the Service.</p>

<h2>1. The Service</h2>
<p>EduSpark is a free educational platform that offers study material, quizzes, previous year question papers (PYQs), doubt-solving (including AI-assisted answers) and notifications for students of CBSE, BSER (RBSE) and competitive exams. The Service is provided for learning support only.</p>

<h2>2. Eligibility</h2>
<ul>
<li>You must be able to form a legally binding contract under Indian law, or have the permission of a parent or legal guardian.</li>
<li>If you are under 18, you may use the Service only with the knowledge and permission of a parent or guardian, who is responsible for your use.</li>
<li>You must give accurate information and must not use the Service if you have been suspended or banned by us.</li>
</ul>

<h2>3. Your account</h2>
<ul>
<li>You may use parts of the Service without signing in. Some features (such as doubts, profile sync and notifications) need a Google sign-in.</li>
<li>Your username must not impersonate anyone, be offensive, or mislead others.</li>
<li>You are responsible for activity under your account and for keeping your Google account secure. Tell us immediately about any unauthorised use.</li>
<li>You can delete your account and data at any time from the Profile page or by following our <a href="/delete-account.html">Account Deletion</a> instructions.</li>
</ul>

<h2>4. Acceptable use</h2>
<p>You agree that you will <strong>not</strong>:</p>
<ul>
<li>break the law or infringe anyone&rsquo;s rights, including copyright and privacy;</li>
<li>post abusive, threatening, hateful, sexual, misleading or spam content, including in doubts and usernames;</li>
<li>attempt to hack, probe, overload, reverse engineer or disrupt the Service, its database or its servers, or bypass any limit, rule or access control (including the admin panel and AI usage limits);</li>
<li>scrape, copy, resell or redistribute content in bulk, or use bots or automated tools to access the Service, except for ordinary search-engine indexing that respects our robots.txt;</li>
<li>use the AI feature to generate harmful content, to cheat in a supervised examination, or to submit personal data of others;</li>
<li>click on, generate artificial traffic for, or otherwise manipulate advertisements shown in the Service;</li>
<li>impersonate EduSpark, a board, an examination body or any person, or claim an affiliation that does not exist.</li>
</ul>

<h2>5. Your content</h2>
<p>You keep ownership of the doubts and other content you submit. By submitting content you grant EduSpark a non-exclusive, worldwide, royalty-free licence to store, display, process and use it to operate, secure and improve the Service (for example, to answer your doubt and show it to administrators). You confirm that you have the right to submit it. We may remove content that breaks these Terms.</p>

<h2>6. EduSpark content and intellectual property</h2>
<p>The EduSpark name, logo, design, code and original content are owned by EduSpark. You may use the Service for your own personal, non-commercial study. You may not copy, sell or republish our content or code without written permission. Names such as CBSE, BSER/RBSE and SSC are trademarks of their respective owners and are used only to describe the syllabus or exam a resource is meant for.</p>
<h3>Copyright complaints</h3>
<p>Question papers, books and other materials belong to their respective owners. If you believe content on EduSpark infringes your copyright, email {MAIL} with: (a) your name and contact details; (b) a description of the work and the exact location (URL or screen) of the content; (c) a statement that you are the owner or authorised to act for the owner; and (d) a statement that the information is accurate. We will review it and remove content promptly where appropriate. We may also remove content from repeat infringers.</p>

<h2>7. AI features and educational content</h2>
<p>Content, quizzes, explanations and AI-generated answers are provided to support study and may contain errors or be out of date. They are not professional or official advice. You must verify important information with your teacher, textbooks and official notices from the relevant board or examination body. We do not guarantee any exam result, rank, selection or marks. AI usage may be limited per user per day.</p>

<h2>8. Notifications</h2>
<p>If you allow notifications, you agree to receive study reminders, announcements and offers from us. You can turn them off at any time in your browser or phone settings. We do not guarantee delivery or exact timing.</p>

<h2>9. Advertising, offers and third-party links</h2>
<p>The Service may display advertisements (including Google AdSense) and sponsored offers, and may link to third-party websites. We do not control or endorse third-party content, products or services, and we are not responsible for transactions or dealings between you and any third party. Use of third-party services is at your own risk and subject to their terms.</p>

<h2>10. Free service, changes and termination</h2>
<p>The Service is currently free. We may change, suspend or discontinue any part of it, or introduce paid features in future with notice. We may suspend or terminate access, remove content or delete accounts at any time if we believe you have broken these Terms or the law, or to protect the Service and other users. You may stop using the Service at any time.</p>

<h2>11. Disclaimer of warranties</h2>
<p>To the maximum extent permitted by law, the Service is provided &ldquo;as is&rdquo; and &ldquo;as available&rdquo; without warranties of any kind, whether express or implied, including accuracy, availability, uninterrupted or error-free operation, and fitness for a particular purpose.</p>

<h2>12. Limitation of liability</h2>
<p>To the maximum extent permitted by law, EduSpark and its owner will not be liable for any indirect, incidental, special, consequential or punitive damages, or for loss of data, marks, opportunities or profits, arising from your use of or inability to use the Service, errors in content or AI answers, or actions of third parties. Where liability cannot be excluded, our total liability will not exceed the amount you paid to us for the Service, which is zero for the free Service.</p>

<h2>13. Indemnity</h2>
<p>You agree to indemnify and hold harmless EduSpark and its owner from claims, losses and expenses (including reasonable legal fees) arising from your content, your breach of these Terms or your violation of any law or third-party right.</p>

<h2>14. Governing law and disputes</h2>
<p>These Terms are governed by the laws of India. Subject to applicable law, the courts at Jaipur, Rajasthan have exclusive jurisdiction over any dispute. We encourage you to contact us first so that we can try to resolve the issue informally.</p>

<h2>15. Changes to these Terms</h2>
<p>We may update these Terms from time to time. The updated version will be posted on this page with a new date. Continued use of the Service after a change means you accept the updated Terms.</p>

<h2>16. General</h2>
<p>If any part of these Terms is found unenforceable, the rest remains in effect. Our failure to enforce a right is not a waiver. These Terms, with the Privacy Policy and other linked policies, are the entire agreement between you and EduSpark about the Service.</p>

<h2>17. Contact</h2>
<p>EduSpark, Jaipur, Rajasthan, India. Email: {MAIL}. Instagram: {IG}. Phone/WhatsApp: <a href="tel:+918094120884">+91 80941 20884</a>.</p>
'''
TERMS_HI = ('<strong>हिंदी सारांश:</strong> EduSpark एक free पढ़ाई का app है। 18 साल से कम उम्र के students माता-पिता/अभिभावक की जानकारी में ही इस्तेमाल करें। '
 'app का दुरुपयोग, hacking, कॉपी/स्क्रैपिंग, गलत या अभद्र content और ads पर नकली click मना हैं। AI के जवाब गलत हो सकते हैं, इसलिए ज़रूरी बातें किताब/teacher से जाँचें। '
 'हम परीक्षा में किसी result की guarantee नहीं देते। पूरी और बाध्यकारी शर्तें नीचे English में हैं।')

DISCLAIMER = f'''
<h2>Independent app</h2>
<p>EduSpark is an independent educational app. It is <strong>not</strong> affiliated with, endorsed by, or an official app of the Central Board of Secondary Education (CBSE), the Board of Secondary Education Rajasthan (BSER/RBSE), the Staff Selection Commission (SSC), or any other board, university, government department or examination body. Their names are used only to describe which syllabus or exam a resource is meant for. All trademarks belong to their owners.</p>
<h2>Educational purpose and accuracy</h2>
<p>We try to keep our study material, quizzes and answers accurate, but errors and outdated information are possible. Syllabus, exam pattern, dates, eligibility and marking schemes are decided by the official bodies and may change without notice. Always confirm the latest information on the official website or notification before you rely on it.</p>
<h2>AI-generated answers</h2>
<p>Some answers are generated by an artificial-intelligence model. They can be incorrect, incomplete or misleading. They are not a substitute for a teacher, a textbook or official guidance. Do not enter personal information in a doubt.</p>
<h2>No guarantee of results</h2>
<p>Using EduSpark does not guarantee any marks, rank, admission, selection or job. Your results depend on your own effort and many factors outside our control.</p>
<h2>Question papers and third-party material</h2>
<p>Previous year question papers and similar material are shared for educational reference. Copyright in such material belongs to the respective boards, authors or publishers. If you are a rights holder and want something removed, please follow the copyright process in our <a href="/terms.html">Terms of Use</a> or email {MAIL}.</p>
<h2>External links, offers and advertisements</h2>
<p>EduSpark may contain links, sponsored offers and advertisements. We do not control third-party websites or products and are not responsible for them. Advertisements are provided by Google AdSense or other partners and do not imply our endorsement.</p>
<h2>Limitation</h2>
<p>To the extent permitted by law, we are not liable for any loss arising from reliance on content in the Service. See our <a href="/terms.html">Terms of Use</a> and <a href="/privacy.html">Privacy Policy</a> for details.</p>
'''

ADS = f'''
<p>EduSpark is free to use. To cover running costs, we show advertisements provided by Google AdSense on some pages. This page explains how ads and cookies work on EduSpark and how you can control them.</p>
<h2>Advertising</h2>
<p>Third-party vendors, including Google, use cookies or device identifiers to serve ads based on your previous visits to EduSpark or other websites. Google&rsquo;s use of advertising cookies enables it and its partners to serve ads to you based on your visit to our site and/or other sites on the internet.</p>
<ul>
<li>Opt out of personalised advertising: <a href="https://adssettings.google.com" rel="noopener">Google Ads Settings</a>.</li>
<li>Opt out of some third-party vendors&rsquo; cookies: <a href="https://www.aboutads.info" rel="noopener">aboutads.info</a>.</li>
<li>How Google uses data from sites that use its services: <a href="https://policies.google.com/technologies/partner-sites" rel="noopener">policies.google.com/technologies/partner-sites</a>.</li>
</ul>
<h2>Students and under-18 users</h2>
<p>Many EduSpark users are under 18. We do not intentionally show personalised or interest-based ads to children, and we configure ad requests for restricted data processing / non-personalised ads wherever the ad platform allows. Ads are never placed on login, consent or quiz-taking screens, and we do not ask you to click on ads.</p>
<h2>Other cookies and similar technologies</h2>
<div class="tw"><table>
<tr><th>Technology</th><th>Purpose</th><th>Notes</th></tr>
<tr><td>Local storage / IndexedDB / service-worker cache</td><td>Remember your profile, settings, progress and offline content</td><td>Stored on your device; clear from browser settings</td></tr>
<tr><td>Firebase Authentication tokens</td><td>Keep you signed in when you use Google Sign-In</td><td>Removed when you log out</td></tr>
<tr><td>Firebase Cloud Messaging token</td><td>Deliver notifications you allowed</td><td>Removed when you turn off notifications or delete your account</td></tr>
<tr><td>Sentry (crash reports)</td><td>Find and fix errors</td><td>Starts only after you accept the consent checkbox; no name or email</td></tr>
<tr><td>Google AdSense cookies</td><td>Serve and measure advertising</td><td>See opt-out links above</td></tr>
<tr><td>Firebase Analytics, Microsoft Clarity</td><td>Usage analytics</td><td>Currently switched off</td></tr>
</table></div>
<h2>Your choices</h2>
<ul>
<li>Block or delete cookies and site data in your browser settings (some features may stop working).</li>
<li>Use Google Ads Settings to turn off ad personalisation.</li>
<li>Withdraw consent by logging out; you will be asked again at the next login.</li>
</ul>
<p>For more about how we handle personal data, read the <a href="/privacy.html">Privacy Policy</a>. Questions: {MAIL}.</p>
'''

DELETE = f'''
<p>You can delete your EduSpark account and data at any time. This page explains how.</p>
<h2>Option 1: inside the app (fastest)</h2>
<ol>
<li>Open EduSpark and tap your <strong>profile photo</strong> at the top.</li>
<li>On the Profile page, scroll down and tap <strong>&ldquo;Delete account and data&rdquo;</strong>.</li>
<li>Confirm and type <strong>DELETE</strong> when asked.</li>
<li>If you signed in with Google, you may be asked to sign in once more for security.</li>
</ol>
<p>When you confirm, the data below is removed immediately and the app starts fresh.</p>
<h2>What is deleted</h2>
<ul>
<li>Your profile: name, username, photo and board.</li>
<li>Your email and Google user ID record.</li>
<li>Your notification token.</li>
<li>All doubts you submitted (and their answers).</li>
<li>Your Firebase sign-in account.</li>
</ul>
<h2>What is not deleted</h2>
<p>If you accepted crash reports, anonymous technical error data may remain with Sentry under its own retention rules; we do not link it to your name or email. Backups held by service providers are overwritten on their normal schedule.</p>
<h2>Option 2: if you cannot open the app</h2>
<p>If you lost your phone or cannot access your account, email {MAIL} or message {IG} on Instagram with the subject <strong>&ldquo;Delete my EduSpark data&rdquo;</strong> and include your username or registered email. After we verify that the account is yours, we will delete the data, usually within 7 days.</p>
<p lang="hi"><strong>हिंदी में:</strong> App खोलें &rarr; ऊपर profile photo &rarr; नीचे &ldquo;Account और data delete करें&rdquo; &rarr; DELETE लिखकर confirm करें। App न खुले तो ऊपर दिए email या Instagram पर &ldquo;Delete my EduSpark data&rdquo; लिखकर भेजें।</p>
<p>See also: <a href="/privacy.html">Privacy Policy</a> &middot; <a href="/terms.html">Terms of Use</a>.</p>
'''

ABOUT = f'''
<p class="lead">EduSpark is a free learning platform for CBSE and BSER (RBSE) Class 10 and 12 students, and for learners preparing for SSC, REET, BSTC and similar exams. It exists on one simple idea: good exam preparation should not depend on how much a family can spend on coaching or study material.</p>
<h2>What you will find</h2>
<ul>
<li><strong>Practice quizzes</strong> with answers and explanations, in practice mode and timed mock-test mode.</li>
<li><strong>Previous year question papers (PYQs)</strong> organised by board, subject and year.</li>
<li><strong>Study material and notes</strong> by class and subject.</li>
<li><strong>A doubts section</strong> where you can ask questions and, if you wish, get a quick AI-assisted explanation.</li>
<li><strong>Study guides</strong> that explain how to prepare: <a href="/cbse-class-10.html">CBSE 10</a>, <a href="/cbse-class-12.html">CBSE 12</a>, <a href="/bser-class-10.html">BSER 10</a>, <a href="/bser-class-12.html">BSER 12</a>, <a href="/ssc-cgl.html">SSC CGL</a>, <a href="/ssc-chsl.html">SSC CHSL</a>, <a href="/reet-bstc.html">REET &amp; BSTC</a> and <a href="/study-tips.html">study tips</a>.</li>
</ul>
<h2>Who is behind EduSpark</h2>
<p>EduSpark is designed, built and maintained by Bhupesh, a student developer from Jaipur, Rajasthan, who also answers support messages. It is an independent project and is not run by any board, coaching institute or government body.</p>
<h2>How we create and check content</h2>
<ul>
<li>Quizzes and explanations are prepared from textbooks, official syllabi and previous year papers, then checked before they are published. The admin panel rejects malformed quiz files so that broken questions do not reach students.</li>
<li>AI is used only for the optional doubt-solving feature. AI answers are labelled and can be wrong; we ask students to verify them.</li>
<li>If you find a mistake, tell us and we will correct or remove it. See <a href="/contact.html">Contact</a>.</li>
</ul>
<h2>Our principles</h2>
<ul>
<li><strong>Free to learn:</strong> core study features stay free for students.</li>
<li><strong>Honest about limits:</strong> we say clearly when content is unofficial, when answers come from AI and when information may be out of date.</li>
<li><strong>Privacy first:</strong> we ask for as little data as possible, keep analytics off for minors and let you delete everything.</li>
<li><strong>Listen to students:</strong> most new features and corrections come directly from messages sent to us.</li>
</ul>
<h2>How the app works</h2>
<p>EduSpark is an installable web app: it runs in your browser, can be added to your home screen, needs no app-store download, and keeps content you have already opened available when your internet is slow or offline.</p>
<h2>Your privacy</h2>
<p>We collect only what the app needs, we do not sell your data, and you can delete your account at any time. Read the <a href="/privacy.html">Privacy Policy</a> and <a href="/terms.html">Terms of Use</a>.</p>
<p><a class="cta" href="/">Start learning</a></p>
'''

CONTACT = f'''
<p class="lead">Have a question, found a mistake in a quiz, need help with your account, or want to report content? Write to us and we will get back to you.</p>
<h2>Reach us</h2>
<ul>
<li><strong>Email:</strong> {MAIL} (best for account, privacy and copyright requests)</li>
<li><strong>WhatsApp:</strong> <a href="https://wa.me/918094120884" rel="noopener">+91 80941 20884</a></li>
<li><strong>Phone:</strong> <a href="tel:+918094120884">+91 80941 20884</a></li>
<li><strong>Instagram:</strong> {IG}</li>
</ul>
<p>We usually reply within 7 days. Please do not send passwords, OTPs or payment details.</p>
<h2>What to include</h2>
<ul>
<li><strong>Bug or wrong answer:</strong> the board/class, subject, quiz or paper name and the question number.</li>
<li><strong>Account or data request:</strong> your username or registered email. See <a href="/delete-account.html">Account Deletion</a>.</li>
<li><strong>Copyright complaint:</strong> follow the steps in our <a href="/terms.html">Terms of Use</a>.</li>
</ul>
<h2>What we cannot do</h2>
<p>We cannot recover a Google account password, change official exam dates or results, or confirm admissions and selections. For those, use the official websites of your board or the examination body.</p>
<h2>Grievance contact</h2>
<p>Bhupesh, EduSpark, Jaipur, Rajasthan, India &mdash; {MAIL}. Complaints are acknowledged within 7 days and aimed to be resolved within 30 days.</p>
<h2>Advertising enquiries</h2>
<p>EduSpark does not sell paid placements inside quizzes or study content. Offers shown in the app are chosen by us. Write to {MAIL} for any questions about an advertisement you saw.</p>
'''

def build():
    return {
     'privacy.html': page('privacy.html','Privacy Policy | EduSpark','How EduSpark collects, uses, shares and protects personal data, including Google AdSense advertising, notifications, children\'s privacy and your rights.','Privacy Policy',PRIVACY,crumb='Privacy Policy',hi_summary=PRIVACY_HI),
     'terms.html': page('terms.html','Terms of Use | EduSpark','The rules for using EduSpark: eligibility, acceptable use, your content, AI answers, ads, copyright complaints, liability and governing law.','Terms of Use',TERMS,crumb='Terms of Use',hi_summary=TERMS_HI),
     'disclaimer.html': page('disclaimer.html','Disclaimer | EduSpark','EduSpark is an independent study app, not affiliated with CBSE, BSER or SSC. Content and AI answers may contain errors; verify with official sources.','Disclaimer',DISCLAIMER,crumb='Disclaimer'),
     'ads-and-cookies.html': page('ads-and-cookies.html','Ads and Cookies Policy | EduSpark','How EduSpark uses Google AdSense, cookies and local storage, how we treat under-18 users, and how to opt out of personalised ads.','Ads and Cookies',ADS,crumb='Ads & Cookies'),
     'delete-account.html': page('delete-account.html','Delete Your EduSpark Account and Data','Step-by-step instructions to delete your EduSpark account and data from inside the app, or by email if you cannot access the app.','Delete Your Account and Data',DELETE,crumb='Delete account'),
     'about.html': page('about.html','About EduSpark: Free Learning for CBSE and BSER Students','About EduSpark: a free study app for CBSE and BSER Class 10 and 12 and competitive exams. Who builds it, how content is created and checked.','About EduSpark',ABOUT,crumb='About',updated=False),
     'contact.html': page('contact.html','Contact EduSpark: Support, Feedback and Data Requests','Contact EduSpark by email, WhatsApp or Instagram for support, quiz corrections, copyright complaints and account or data requests.','Contact Us',CONTACT,crumb='Contact',updated=False),
    }
