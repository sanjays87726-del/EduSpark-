# Original study-guide pages (educational content for AdSense "publisher content" + search). Facts kept general; every page links to the official source.
from common import page

OFFICIAL = {
 'cbse': ('<li><a href="https://www.cbse.gov.in/" rel="noopener">CBSE official website</a> &ndash; circulars, exam dates, scheme of assessment</li>'
          '<li><a href="https://cbseacademic.nic.in/" rel="noopener">CBSE Academic</a> &ndash; curriculum, syllabus, sample papers and marking schemes</li>'
          '<li><a href="https://ncert.nic.in/" rel="noopener">NCERT</a> &ndash; free official textbooks</li>'),
 'bser': ('<li><a href="https://rajeduboard.rajasthan.gov.in/" rel="noopener">Rajasthan Board of Secondary Education (RBSE/BSER), Ajmer</a> &ndash; syllabus, time table, results</li>'),
 'ssc':  ('<li><a href="https://ssc.gov.in/" rel="noopener">Staff Selection Commission (SSC)</a> &ndash; notifications, syllabus and exam dates</li>'),
}

def use_eduspark(items):
    li = ''.join(f'<li>{i}</li>' for i in items)
    return (f'<h2>How to use EduSpark for this</h2><ul>{li}</ul>'
            '<p><a class="cta" href="/">Open EduSpark (free)</a></p>')

def official(key, extra=''):
    return (f'<h2>Official sources &ndash; always confirm here</h2><ul>{OFFICIAL[key]}{extra}</ul>'
            '<div class="note"><strong>Please note:</strong> Exam patterns, marking schemes and dates change. This guide is general preparation advice written by EduSpark. '
            'It is not an official notification. Always confirm the latest details on the official websites above.</div>')

PAGES = {}

PAGES['cbse-class-10.html'] = dict(
 title='CBSE Class 10 Study Guide: Plan, PYQs and Practice | EduSpark',
 desc='A practical CBSE Class 10 board exam study guide: how to use NCERT, sample papers and previous year questions, a revision plan and common mistakes to avoid.',
 h1='CBSE Class 10 Board Exam Study Guide',
 body='''
<p class="lead">The CBSE Class 10 board exam rewards students who understand concepts and practise writing answers in the board&rsquo;s style. This guide explains a simple way to organise your preparation, whether you have six months or six weeks.</p>
<h2>What you need to cover</h2>
<p>Most students study two languages (for example English and Hindi), Mathematics, Science and Social Science, plus any additional subject they have chosen. In Mathematics you choose between the Standard and Basic papers, so confirm which one you are preparing for and use the matching syllabus and sample papers.</p>
<h2>A realistic preparation plan</h2>
<ol>
<li><strong>Finish NCERT first.</strong> For Science, Mathematics and Social Science, the NCERT textbook is the base of the paper. Read every chapter, solve every in-text and exercise question, and mark the topics you find hard.</li>
<li><strong>Make short notes while you read.</strong> One page per chapter: definitions, formulae, diagrams, dates and keywords. These notes become your last-week revision material.</li>
<li><strong>Practise question types, not only chapters.</strong> Recent papers include competency-based questions such as case-based, source-based and assertion&ndash;reason questions along with the traditional short and long answers. Practise each type separately.</li>
<li><strong>Solve previous year papers in exam conditions.</strong> Set a timer, write on paper, then check against the official marking scheme. Note which marks you lost and why.</li>
<li><strong>Revise in cycles.</strong> Revise a chapter after one day, one week and one month. Short, repeated revision beats one long session before the exam.</li>
</ol>
<h2>Subject-wise tips</h2>
<h3>Mathematics</h3><p>Practise daily. Learn formulae with their conditions, show every step because marks are given for steps, and keep the last 15 minutes of the paper for checking calculations.</p>
<h3>Science</h3><p>Draw and label diagrams neatly, learn chemical equations with balancing, and write numerical answers with units. For Biology and Physics concepts, explain in your own words using the keywords from NCERT.</p>
<h3>Social Science</h3><p>Use a timeline for History, map practice for Geography, and short keyword-based answers for Civics and Economics. Practise map work regularly, because it is easy marks.</p>
<h3>English and Hindi</h3><p>Practise the writing formats (letter, notice, article, message) and unseen passages. Read the literature chapters once for the story and once for the questions.</p>
{use}
<h2>Common mistakes to avoid</h2>
<ul>
<li>Studying only from guide books and skipping NCERT.</li>
<li>Reading answers without writing them &ndash; board marks depend on written presentation.</li>
<li>Ignoring internal assessment and practical work, which also count towards the final result.</li>
<li>Leaving revision for the last week and sleeping very little before the exam.</li>
</ul>
{off}
''',
 use=["<strong>Quizzes</strong> &ndash; take short chapter-wise quizzes after reading each NCERT chapter and review the explanations for wrong answers.",
      "<strong>PYQ section</strong> &ndash; solve previous year question papers under a timer and compare with the marking scheme.",
      "<strong>Doubts</strong> &ndash; post a question in the doubts section. The AI helper can give a quick explanation, but please verify important answers with your teacher or textbook."],
 off=lambda: official('cbse'),
 crumb='CBSE Class 10')

PAGES['cbse-class-12.html'] = dict(
 title='CBSE Class 12 Study Guide: Streams, PYQs and Revision Plan | EduSpark',
 desc='CBSE Class 12 board exam preparation guide: how to plan by stream, use NCERT and previous year papers, manage practicals and revise effectively.',
 h1='CBSE Class 12 Board Exam Study Guide',
 body='''
<p class="lead">Class 12 results matter for college admissions and for many entrance exams, so a steady plan is more useful than last-minute cramming. This guide gives a structure that works for Science, Commerce and Humanities students.</p>
<h2>Plan by stream</h2>
<div class="tw"><table>
<tr><th>Stream</th><th>Typical subjects</th><th>Where marks are usually won</th></tr>
<tr><td>Science</td><td>Physics, Chemistry, Mathematics or Biology, English</td><td>Numerical practice, derivations, reaction mechanisms, labelled diagrams</td></tr>
<tr><td>Commerce</td><td>Accountancy, Business Studies, Economics, Mathematics (optional), English</td><td>Format-based accounting problems, definitions, case studies</td></tr>
<tr><td>Humanities</td><td>History, Political Science, Geography, Economics, languages</td><td>Structured long answers, maps, examples and keywords</td></tr>
</table></div>
<p>Subject combinations differ between schools, so use the list your school has registered for you.</p>
<h2>How to prepare</h2>
<ol>
<li><strong>Anchor everything on NCERT.</strong> Most conceptual questions come from the NCERT text. Finish the exercises before moving to reference books.</li>
<li><strong>Use the official curriculum and sample paper.</strong> Check chapter-wise marks distribution so that you spend time in proportion to marks.</li>
<li><strong>Keep an error notebook.</strong> Every time you get a question wrong, write the question, the correct method and the reason you made the mistake. Review this notebook every week.</li>
<li><strong>Do not neglect practicals and projects.</strong> They are scored internally and are the easiest marks to secure with regular work.</li>
<li><strong>Full-length practice.</strong> In the last eight weeks, solve one full paper every two or three days in exam time, then analyse it.</li>
</ol>
<h2>If you are also preparing for entrance exams</h2>
<p>Strong NCERT fundamentals help in entrance tests such as JEE, NEET or CUET, but those exams have their own syllabus and style. Plan separate time for them and do not compromise board preparation.</p>
{use}
<h2>Common mistakes to avoid</h2>
<ul>
<li>Skipping the writing practice and only reading solutions.</li>
<li>Not learning the answer-presentation style: headings, steps, units, diagrams.</li>
<li>Comparing your pace with others instead of tracking your own weekly progress.</li>
</ul>
{off}
''',
 use=["<strong>Subject quizzes</strong> &ndash; use the Class 12 quizzes to test a chapter right after finishing it.",
      "<strong>PYQ papers</strong> &ndash; practise previous year papers and note the repeated question patterns.",
      "<strong>Offline access</strong> &ndash; content you have already opened stays available when your internet is slow, which helps during travel or low-data days."],
 off=lambda: official('cbse'),
 crumb='CBSE Class 12')

PAGES['bser-class-10.html'] = dict(
 title='BSER (RBSE) Class 10 Study Guide for Rajasthan Board | EduSpark',
 desc='Rajasthan Board (BSER/RBSE) Class 10 preparation guide: studying the board textbooks, practising previous year papers and planning revision.',
 h1='BSER (RBSE) Class 10 Study Guide',
 body='''
<p class="lead">The Board of Secondary Education, Rajasthan (BSER, also written RBSE) conducts the Secondary (Class 10) examination for lakhs of students every year. This guide shows a simple, repeatable method to prepare, in either Hindi or English medium.</p>
<h2>What to study</h2>
<p>Core subjects are generally Hindi, English, Mathematics, Science and Social Science, with a third language or optional subject depending on your school. Download the latest syllabus from the board and prepare strictly from it, because topics can be added or removed between years.</p>
<h2>A step-by-step plan</h2>
<ol>
<li><strong>Textbook first.</strong> Read the prescribed textbook line by line. Questions in board papers are closely tied to the textbook language, so underline definitions and key terms.</li>
<li><strong>Write, do not just read.</strong> Practise writing answers within the expected length. For Social Science, learn to organise a long answer in a heading, three or four points and a conclusion.</li>
<li><strong>Previous year papers.</strong> Solve the last several years of papers. You will notice that important topics repeat, and you will learn how the paper is structured.</li>
<li><strong>Weak-topic list.</strong> After each paper, list the topics where you lost marks and give them extra time the next week.</li>
<li><strong>Final month.</strong> Revise from your short notes, redo the error list and take two or three full papers in exam time.</li>
</ol>
<h2>Subject tips</h2>
<ul>
<li><strong>Mathematics:</strong> daily practice of every exercise type; write formulae before solving; check units and signs.</li>
<li><strong>Science:</strong> neat labelled diagrams, balanced equations and numericals with units.</li>
<li><strong>Social Science:</strong> maps, timelines and short keyword-rich answers; practise Rajasthan-specific topics where they appear in the syllabus.</li>
<li><strong>Hindi and English:</strong> grammar, letter and essay formats, and clean handwriting.</li>
</ul>
{use}
<h2>Common mistakes to avoid</h2>
<ul>
<li>Studying from guess papers instead of the syllabus.</li>
<li>Leaving one subject completely for the last week.</li>
<li>Not practising with a timer, then running out of time in the exam hall.</li>
</ul>
{off}
''',
 use=["<strong>BSER Class 10 content</strong> &ndash; select BSER Class 10 as your board in the app to see content and quizzes for it.",
      "<strong>Practice quizzes</strong> &ndash; short quizzes with answers and explanations after each chapter.",
      "<strong>PYQ section</strong> &ndash; previous year papers for self-testing under time limits."],
 off=lambda: official('bser'),
 crumb='BSER Class 10')

PAGES['bser-class-12.html'] = dict(
 title='BSER (RBSE) Class 12 Study Guide: Arts, Science, Commerce | EduSpark',
 desc='Rajasthan Board (BSER/RBSE) Class 12 preparation guide for Arts, Science and Commerce: syllabus-first planning, previous year papers and revision strategy.',
 h1='BSER (RBSE) Class 12 Study Guide',
 body='''
<p class="lead">The Senior Secondary (Class 12) examination of the Rajasthan Board is offered in three broad streams: Arts, Science and Commerce. This guide gives a common framework you can adapt to your stream and your subjects.</p>
<h2>Start with the syllabus and your subject list</h2>
<p>Write down every subject you have registered for, then download the syllabus for each one from the board website. Tick off each unit as you finish it. This one-page checklist keeps you honest about what is actually complete.</p>
<h2>Weekly study structure</h2>
<ul>
<li><strong>Four days:</strong> new chapters (one main subject per session, one lighter subject for variety).</li>
<li><strong>One day:</strong> revision of the week&rsquo;s chapters using short notes.</li>
<li><strong>One day:</strong> a timed paper or half-paper from a previous year.</li>
<li><strong>One day:</strong> rest, light reading or practicals.</li>
</ul>
<h2>Stream-wise focus</h2>
<h3>Science</h3><p>Concepts and numericals in Physics and Chemistry, and diagrams and terminology in Biology. Practise derivations by writing them, not only reading them. Do not skip practical records.</p>
<h3>Commerce</h3><p>Accountancy needs daily problem practice and correct formats. For Business Studies and Economics, learn definitions precisely and add one example to each answer.</p>
<h3>Arts</h3><p>Long answers carry weight. Practise writing structured answers with an introduction, 4&ndash;6 points and a conclusion. Use maps, timelines and examples wherever the subject allows.</p>
{use}
<h2>Exam-week checklist</h2>
<ul>
<li>Keep your admit card, school ID and stationery ready the night before, and plan to reach the centre early.</li>
<li>Spend the first ten minutes reading the whole paper; attempt the questions you are surest of first, then the rest.</li>
<li>Keep the last ten minutes for checking numbering, units and diagrams.</li>
</ul>
<h2>Common mistakes to avoid</h2>
<ul>
<li>Preparing for competitive exams in a way that leaves board subjects half-finished.</li>
<li>Not revising: chapters read once are forgotten within weeks.</li>
<li>Ignoring the marks distribution and giving equal time to low-weightage topics.</li>
</ul>
{off}
''',
 use=["<strong>Choose your board</strong> &ndash; pick BSER Class 12 inside the app to see content for your class.",
      "<strong>Quizzes and PYQs</strong> &ndash; build a habit of one quiz a day and one paper a week.",
      "<strong>Doubts</strong> &ndash; ask a doubt with the subject and topic so the answer can be specific."],
 off=lambda: official('bser'),
 crumb='BSER Class 12')

PAGES['ssc-cgl.html'] = dict(
 title='SSC CGL Preparation Guide: Sections, Plan and PYQs | EduSpark',
 desc='SSC CGL preparation guide: the four Tier 1 sections, a section-wise study plan, how to use previous year questions and mock tests, and common mistakes.',
 h1='SSC CGL Preparation Guide',
 body='''
<p class="lead">The Combined Graduate Level (CGL) examination, conducted by the Staff Selection Commission, is one of the most popular graduate-level government exams in India. This guide explains how to organise preparation around the main sections.</p>
<h2>Main sections in the first tier</h2>
<div class="tw"><table>
<tr><th>Section</th><th>What it tests</th><th>How to practise</th></tr>
<tr><td>General Intelligence &amp; Reasoning</td><td>Analogies, series, coding-decoding, syllogisms, puzzles, non-verbal reasoning</td><td>Daily timed sets; learn shortcuts only after you understand the logic</td></tr>
<tr><td>General Awareness</td><td>Static GK, history, polity, geography, science, current affairs</td><td>Short notes, weekly revision, monthly current-affairs recap</td></tr>
<tr><td>Quantitative Aptitude</td><td>Arithmetic, algebra, geometry, trigonometry, data interpretation</td><td>Formula sheet, chapter-wise practice, speed drills</td></tr>
<tr><td>English Comprehension</td><td>Grammar, vocabulary, error spotting, cloze test, reading comprehension</td><td>Daily reading, vocabulary list, grammar rules with examples</td></tr>
</table></div>
<p>The exam has more than one stage and the pattern is updated from time to time, so read the latest official notification for tiers, marking and negative marking.</p>
<h2>A 90-day outline</h2>
<ol>
<li><strong>Days 1&ndash;30: foundation.</strong> Cover every topic once. Make a formula sheet for Maths and a vocabulary list for English.</li>
<li><strong>Days 31&ndash;60: practice.</strong> Chapter-wise questions, then sectional timed tests. Maintain an error log.</li>
<li><strong>Days 61&ndash;90: tests and revision.</strong> Full mock tests, analysis of each mock, and revision of the error log and notes.</li>
</ol>
<h2>How to use previous year questions</h2>
<p>Solve earlier shifts and years topic-wise first, then as full papers. Note which topics repeat, which type of question takes you the most time, and where you lose marks to silly mistakes. Previous year questions show the difficulty level and style, but they are not a substitute for learning the concepts.</p>
{use}
<h2>Common mistakes to avoid</h2>
<ul>
<li>Taking many mocks but never analysing them.</li>
<li>Ignoring negative marking and guessing blindly.</li>
<li>Leaving English for the end &ndash; it improves slowly and needs daily exposure.</li>
</ul>
{off}
''',
 use=["<strong>SSC CGL practice</strong> &ndash; choose SSC CGL as your exam in the app for quizzes and papers.",
      "<strong>Practice and mock modes</strong> &ndash; practise a topic with instant explanations, then switch to timed mock mode.",
      "<strong>Question palette and review</strong> &ndash; review every attempt to see which answers were wrong and why."],
 off=lambda: official('ssc'),
 crumb='SSC CGL')

PAGES['ssc-chsl.html'] = dict(
 title='SSC CHSL Preparation Guide for 10+2 Level Exam | EduSpark',
 desc='SSC CHSL (10+2) preparation guide: sections to cover, a weekly plan for Reasoning, Maths, English and General Awareness, and how to use practice papers.',
 h1='SSC CHSL Preparation Guide',
 body='''
<p class="lead">The Combined Higher Secondary Level (CHSL) examination is conducted by the Staff Selection Commission for candidates who have passed Class 12 (10+2). Preparation is built around a few sections that you can master with consistent practice.</p>
<h2>Sections to cover</h2>
<ul>
<li><strong>General Intelligence / Reasoning</strong> &ndash; verbal and non-verbal reasoning.</li>
<li><strong>General Awareness</strong> &ndash; static GK, polity, history, geography, basic science and current affairs.</li>
<li><strong>Quantitative Aptitude</strong> &ndash; arithmetic and basic mathematics at the level of Class 10&ndash;12.</li>
<li><strong>English Language</strong> &ndash; grammar, vocabulary, comprehension and writing-based skills.</li>
</ul>
<p>Later stages may include skill or typing tests depending on the post, and the details change by notification. Read the current notice carefully before you plan.</p>
<h2>Weekly plan (example)</h2>
<div class="tw"><table>
<tr><th>Day</th><th>Focus</th></tr>
<tr><td>Mon / Thu</td><td>Quantitative Aptitude: one topic + 30 timed questions</td></tr>
<tr><td>Tue / Fri</td><td>Reasoning: two topics + a short sectional test</td></tr>
<tr><td>Wed / Sat</td><td>English: grammar rule, vocabulary, one comprehension passage</td></tr>
<tr><td>Daily (20 min)</td><td>General Awareness: notes revision and current-affairs summary</td></tr>
<tr><td>Sun</td><td>Full or half mock test and error analysis</td></tr>
</table></div>
<h2>Practice approach</h2>
<p>Start with accuracy, then add speed. Solve 20 questions slowly and check each one, then repeat the same set under a timer. Keep a notebook for formulae, tricky rules and words you missed, and read it every Sunday.</p>
{use}
<h2>Time and negative marking</h2>
<p>In a one-hour paper with four sections, give each section a time budget (for example 15 minutes) during mocks and learn to move on when a question is eating your time. If the paper has negative marking, attempt a question only when you can eliminate at least two options by reasoning. Track your attempts, accuracy and net score after every mock; accuracy usually matters more than raw attempts.</p>
<h2>Common mistakes to avoid</h2>
<ul>
<li>Memorising GK without revision &ndash; plan a weekly recap.</li>
<li>Skipping basics of Mathematics and jumping to shortcuts.</li>
<li>Not practising on screen if the exam is computer-based.</li>
</ul>
{off}
''',
 use=["<strong>SSC CHSL practice</strong> &ndash; pick SSC CHSL as your exam in the app.",
      "<strong>Sectional quizzes</strong> &ndash; practise one section at a time with explanations.",
      "<strong>Doubts</strong> &ndash; ask a reasoning or maths doubt and compare the explanation with your own method."],
 off=lambda: official('ssc'),
 crumb='SSC CHSL')

PAGES['reet-bstc.html'] = dict(
 title='REET and BSTC Preparation Guide for Rajasthan Teacher Exams | EduSpark',
 desc='REET and BSTC (Pre-DElEd) preparation guide for Rajasthan: subject areas, Child Development and Pedagogy tips, a study plan and how to use practice quizzes.',
 h1='REET and BSTC Preparation Guide',
 body='''
<p class="lead">Many students in Rajasthan prepare for teaching careers through the Rajasthan Eligibility Examination for Teachers (REET) and the Basic School Teaching Certificate (BSTC, also called Pre-DElEd). This page summarises how to plan preparation for both.</p>
<h2>REET at a glance</h2>
<p>REET is conducted by the Board of Secondary Education, Rajasthan. It has two levels: Level 1 for teaching the primary classes and Level 2 for the upper primary classes. The paper generally combines Child Development and Pedagogy, two languages, and subject sections such as Mathematics, Environmental Studies, Science or Social Studies, depending on the level. Check the current notification for the exact scheme.</p>
<h2>BSTC (Pre-DElEd) at a glance</h2>
<p>BSTC is an entrance test for admission to the elementary teacher education course in Rajasthan. The test is held by an agency or university appointed by the state government, and the topics usually include mental ability, teaching aptitude, general awareness (including Rajasthan-specific topics) and language skills. The conducting body and the pattern can change, so rely on the official prospectus.</p>
<h2>Preparation plan</h2>
<ol>
<li><strong>Child Development and Pedagogy.</strong> Learn the major theories, their thinkers and examples of classroom use. Questions often test the application of an idea in a classroom situation.</li>
<li><strong>Languages.</strong> Practise grammar, comprehension and teaching-method questions in Hindi and English.</li>
<li><strong>Mathematics and EVS / Science / Social Studies.</strong> Cover the school syllabus up to the relevant level, then add the teaching-methodology topics.</li>
<li><strong>Rajasthan GK (for BSTC).</strong> Make short notes on history, geography, culture, art and economy of Rajasthan and revise weekly.</li>
<li><strong>Timed practice.</strong> Take a mock paper every week and analyse mistakes by topic.</li>
</ol>
{use}
<h2>Common mistakes to avoid</h2>
<ul>
<li>Memorising theories without understanding classroom examples.</li>
<li>Ignoring the teaching-methodology section while focusing only on subject knowledge.</li>
<li>Using outdated material after the pattern or syllabus has changed.</li>
</ul>
{off}
''',
 use=["<strong>Practice quizzes</strong> &ndash; use subject quizzes for Hindi, English, Maths and general awareness while you study.",
      "<strong>PYQ practice</strong> &ndash; previous year papers show how pedagogy questions are framed.",
      "<strong>Daily habit</strong> &ndash; reminders (if you enable notifications) help you keep a daily 10-minute practice routine."],
 off=lambda: official('bser', '<li>For BSTC, see the official information issued by the Rajasthan government and the conducting university for the current year.</li>'),
 crumb='REET and BSTC')

PAGES['study-tips.html'] = dict(
 title='How to Study with Previous Year Questions and Quizzes | EduSpark',
 desc='A practical method for board and competitive exam students: how to use previous year questions, quizzes, error logs and spaced revision effectively.',
 h1='How to Study with Previous Year Questions and Quizzes',
 body='''
<p class="lead">Previous year questions (PYQs) and quizzes are the fastest way to learn what an exam really asks. But they only help if you use them in the right order. This page describes a method you can apply to any board or competitive exam.</p>
<h2>The six-step method</h2>
<ol>
<li><strong>Learn first, test second.</strong> Read the chapter or topic once before attempting questions on it. Testing a topic you have never studied only teaches you to guess.</li>
<li><strong>Attempt without help.</strong> Answer from memory, in writing where possible. Mark any answer you are unsure about, even if it turns out correct.</li>
<li><strong>Check immediately.</strong> Read the explanation for every wrong or doubtful answer. The explanation is where the learning happens.</li>
<li><strong>Write in an error log.</strong> For each mistake note the topic, why you were wrong (concept gap, careless error, time pressure, misread question) and the correct method.</li>
<li><strong>Revise on a schedule.</strong> Redo the error-log questions after one day, one week and one month.</li>
<li><strong>Simulate the exam.</strong> Every week, take a timed paper under real conditions and track your score, accuracy and time per section.</li>
</ol>
<h2>Using PYQs well</h2>
<ul>
<li>Sort questions by topic to see which chapters carry the most weight.</li>
<li>Notice the language and format of questions &ndash; examiners often repeat styles even when the numbers change.</li>
<li>Do not memorise answers; the same concept will be asked in a different way.</li>
</ul>
<h2>Using quizzes well</h2>
<ul>
<li>Use short quizzes (10&ndash;20 questions) right after studying a topic and again a week later.</li>
<li>Prefer practice mode with explanations while learning, and timed mock mode when you are exam-ready.</li>
<li>Stop guessing: if negative marking applies, practise skipping questions you cannot reason out.</li>
</ul>
<h2>Staying consistent</h2>
<p>Ten focused minutes every day is better than five hours once a week. Sleep, a short walk and regular meals improve memory and concentration more than another late-night session.</p>
<h2>A note on AI explanations</h2>
<p>EduSpark includes an AI helper that can explain a doubt quickly. AI can make mistakes, so treat its answer as a starting point and verify important facts, formulae and dates with your textbook or teacher.</p>
{use}
''',
 use=["<strong>Practice mode</strong> shows the correct answer and explanation immediately.",
      "<strong>Mock mode</strong> adds a timer and a question palette, like a real exam.",
      "<strong>Quiz analytics</strong> show your accuracy, time and section-wise performance so you know what to fix next."],
 off=lambda: '',
 crumb='Study tips')

def build():
    out = {}
    for slug, d in PAGES.items():
        use = use_eduspark(d['use'])
        body = d['body'].replace('{use}', use).replace('{off}', d['off']())
        out[slug] = page(slug, d['title'], d['desc'], d['h1'], body, crumb=d['crumb'], guide=True)
    return out
