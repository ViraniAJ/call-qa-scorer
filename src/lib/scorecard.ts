// ── Types ───────────────────────────────────────────────────────────────

export interface ScorecardItem {
  id: string;
  label: string;
  points: number;
  criteria: string;
}

export interface ScorecardSection {
  name: string;
  items: ScorecardItem[];
}

export interface Scorecard {
  title: string;
  passingThreshold: number;
  totalPossible: number;
  scriptAdherence: string;
  sections: ScorecardSection[];
  criticalFails: string[];
}

export interface ScoreItem {
  id: string;
  awarded: number;
  maxPoints: number;
  result: "Y" | "N" | "Partial" | "N/A";
  reasoning: string;
}

export interface CriticalFailItem {
  condition: string;
  triggered: boolean;
  evidence: string;
}

export interface ScoringResult {
  scores: ScoreItem[];
  criticalFails: CriticalFailItem[];
  totalScore: number;
  passed: boolean;
  hasCriticalFail: boolean;
  strengths: string[];
  opportunities: string[];
  summary: string;
}

// ── Default Scorecard (SkyBridge) ──────────────────────────────────────

export const DEFAULT_SCORECARD: Scorecard = {
  title: "SkyBridge Loan Sales Call QA Scorecard",
  passingThreshold: 85,
  totalPossible: 100,
  scriptAdherence:
    "Agents are not required to follow the call script verbatim. However, agents must adhere to the substance and intent of the script and may not deviate from its meaning.",
  sections: [
    {
      name: "Compliance",
      items: [
        { id: "c1", label: "Identification", points: 5, criteria: "Agent states their name and that they are calling from Sky Bridge, a partner of the DSP; does not imply calling from the DSP or MRV" },
        { id: "c2", label: "Recording disclosure given", points: 5, criteria: "States call is recorded for quality assurance before PII is requested" },
        { id: "c3", label: "Security verification", points: 10, criteria: "Verifies last 4 SSN and Date of Birth before sharing account details" },
        { id: "c4", label: "NY DNC disclosure", points: 5, criteria: "Provides NY-only internal Do Not Call disclosure and follows process if requested" },
        { id: "c5", label: "Product representation", points: 5, criteria: "Clearly states that the product being offered is a loan" },
        { id: "c6", label: "Loan estimates", points: 5, criteria: "Clearly states that loan terms will be provided as estimates" },
        { id: "c7", label: "Eligibility", points: 5, criteria: "Does not state or suggest that the client is likely to be approved" },
        { id: "c8", label: "Settlement speed", points: 5, criteria: "Does not make any promises with respect to settlement results or timing" },
      ],
    },
    {
      name: "Step 1: Introduction",
      items: [
        { id: "s1_1", label: "Program benefits explained", points: 5, criteria: "Explains per the script how the loan can enable faster settlements, reduce calls/legal risk, and help credit rebuilding" },
      ],
    },
    {
      name: "Step 2: How It Works",
      items: [
        { id: "s2_1", label: "Process clarity", points: 10, criteria: "Explains per the script how loan funds will be used to fund settlements" },
        { id: "s2_2", label: "No obligation stated", points: 5, criteria: "States client is under no obligation to choose loan if approved" },
        { id: "s2_3", label: "Decline path clarity", points: 5, criteria: "Explains that if the consumer applies and the application is denied, the consumer may remain in the debt resolution program" },
      ],
    },
    {
      name: "Step 3: Application",
      items: [
        { id: "s3_1", label: "Permission & channel", points: 5, criteria: "Obtains permission to send application, confirms preferred channel (text/email) and confirms phone number or email before sending" },
        { id: "s3_2", label: "Guided assistance", points: 5, criteria: "Stays on the line to assist; references application sections appropriately" },
        { id: "s3_3", label: "Credit improvement", points: 5, criteria: "Does not promise that program will improve the consumer's credit; if asked, states that resolving debts can improve credit but there is no guarantee" },
        { id: "s3_4", label: "Credit inquiry", points: 5, criteria: "If asked, clearly states that the application will result in a hard inquiry; makes no representations with respect to impact on credit" },
        { id: "s3_5", label: "Application assistance", points: 5, criteria: "Agent does not suggest answers to application questions; if asked, agent encourages applicant to respond to the best of their ability" },
      ],
    },
    {
      name: "Step 4: Decision",
      items: [
        { id: "s4_1", label: "Denial verbiage", points: 5, criteria: "On denial, states that they were unable to approve the application at this time and explains that the consumer will receive a notice in the mail and may stay in their debt resolution program" },
      ],
    },
  ],
  criticalFails: [
    "Failure to complete required security verification before account details are discussed",
    "Failure to clearly describe the product as a loan",
    "Failing to state that call is from Sky Bridge; suggesting or stating that call is from the DSP or MRV",
    "Sharing PII without verification or sending application without permission",
    "Stating or suggesting that the applicant is likely to be approved",
    "Making representations with respect to settlement results or timelines",
    "Making representations regarding loan terms, such as total amount or length",
  ],
};

// ── Sample Transcripts ─────────────────────────────────────────────────

export const GOOD_TRANSCRIPT = `Agent: Good afternoon, this is Maria Rodriguez calling from Sky Bridge. We're a partner of National Debt Solutions, your debt resolution provider. Before we get started, I want to let you know this call is being recorded for quality assurance purposes. May I speak with John Davis?

Customer: Yes, this is John.

Agent: Great, thank you John. For security purposes, before we discuss any account details, I need to verify your identity. Could you please confirm the last four digits of your Social Security number?

Customer: Sure, it's 4821.

Agent: Thank you. And can you also confirm your date of birth?

Customer: March 15th, 1985.

Agent: Perfect, thank you for verifying that. John, I also want to let you know — and this applies to New York residents — you have the right to be placed on our internal Do Not Call list at any time. If you'd like to be added, just let me know and we'll take care of that. Would you like to continue?

Customer: Yeah, let's keep going.

Agent: Great. So John, the reason I'm reaching out is to tell you about a loan product we offer that could really help with your debt resolution journey. I want to be clear upfront — this is a loan, and any terms we discuss today will be estimates only.

Customer: Okay, what kind of loan?

Agent: Good question. So here's how it works: if you're approved for this loan, the funds would be used to settle your enrolled debts through the National Debt Solutions program. This can help speed up the settlement process, which means fewer collection calls and less legal risk while your debts are being resolved. It can also help with rebuilding your credit over time, though I want to be upfront — there's no guarantee that it will improve your credit score. Resolving debts can positively impact credit, but results vary.

Customer: That sounds interesting. So how does the actual process work?

Agent: Sure, let me walk you through it. If you apply and are approved, the loan funds go directly toward settling your debts through the program. Your debt resolution company will work to negotiate settlements with your creditors. I want to be clear — you are under absolutely no obligation to accept the loan even if you're approved. It's completely your choice. And if you apply and the application is denied, you simply continue in your debt resolution program as you are now. Nothing changes.

Customer: What are the chances I'd be approved?

Agent: I can't speak to the likelihood of approval — that depends on the application review process. What I can do is help you get started with the application so you can find out. Would you like to move forward with that?

Customer: Sure, I'll give it a try.

Agent: Great. Would you prefer I send the application via text or email?

Customer: Text would be easier.

Agent: Sure thing. Can you confirm that your current phone number is 555-0142?

Customer: Yes, that's correct.

Agent: Perfect. I'm sending the application to your phone now. I'll stay right here on the line to walk you through it. You should be receiving it any moment.

Customer: Okay, I got it. Opening it now.

Agent: Great. Take your time going through each section. If you have any questions about what a particular field is asking, just let me know and I'll help clarify.

Customer: It's asking for my annual income. Should I include my wife's income too?

Agent: I'd encourage you to answer each question to the best of your ability based on your own understanding. If you're unsure, go with what feels most accurate to you.

Customer: Okay. And this is going to affect my credit, right?

Agent: Yes, I want to be transparent about that. Submitting the application will result in a hard credit inquiry. I can't make any specific representations about how it might impact your score, but it is something to be aware of.

Customer: Alright, I've completed it and hit submit.

Agent: Thank you, John. Give me just a moment while the system processes your application... Unfortunately, John, we were unable to approve the application at this time. You will receive a notice in the mail with more details about this decision. The important thing to know is that you can absolutely stay in your debt resolution program and continue working toward settling your debts.

Customer: That's disappointing but I understand.

Agent: I completely understand. Your debt resolution company will continue working on your behalf. Is there anything else I can help you with today?

Customer: No, that's all. Thanks Maria.

Agent: Thank you for your time, John. Have a great day.`;

export const BAD_TRANSCRIPT = `Agent: Hey there, this is Jake from National Debt Solutions. Am I speaking with Sarah Thompson?

Customer: Yes, this is Sarah.

Agent: Cool, so Sarah I'm calling because we've got this great opportunity for you. You know how you've been in the debt program? Well we can basically get you out of it faster. You're gonna love this.

Customer: Oh really? How so?

Agent: So basically what we do is we give you the money and boom, your debts get settled like that. Most people in your situation get approved no problem, so I wouldn't worry about it. And honestly, once we settle everything, you're looking at maybe two to three months and everything is done. Your credit score is going to bounce right back up too.

Customer: That sounds amazing! How much would the loan be for?

Agent: Based on what I can see here, you're probably looking at around $15,000 over about 36 months. So it's super manageable. Let me pull up your account real quick — I see here you've got three enrolled debts totaling about $22,000...

Customer: Wait, don't you need to verify who I am or something first?

Agent: Oh right, yeah we should do that. What's your date of birth?

Customer: June 3rd, 1990.

Agent: Great, that matches. So anyway, like I was saying, with $22,000 in enrolled debts, this loan is going to knock those out really quick. Want me to go ahead and send over the application?

Customer: Sure, but what if I'm not approved?

Agent: Honestly, you don't really need to worry about that. Like I said, most people get through just fine. Let me shoot that application over to you right now. What's your email?

Customer: It's sarah.t@email.com. But wait, will this affect my credit?

Agent: I mean, every application has some kind of check but it's nothing to worry about. It's not going to hurt your score or anything. Okay so I just sent the application to your email. Go ahead and open it up.

Customer: I see it. Okay, the first question is about my employment. I work part-time but I also do some freelance work. What should I put?

Agent: Just put down whatever makes your income look strongest. If your freelance brings in more, go with that total. They want to see good numbers.

Customer: Okay... and for housing costs, should I include my car payment?

Agent: Nah, just put your rent. Keep those expenses low so it looks better for the approval.

Customer: Done, I submitted it.

Agent: Let me check... Ah bummer, it got declined. But don't worry about it, honestly this system is kind of finicky. You can try again in a few weeks and you'll probably get through. Just keep at it.

Customer: Oh that's frustrating. So what happens now?

Agent: Just hang tight and we'll probably reach back out in a month or so. These things work out eventually.

Customer: Alright, thanks Jake.

Agent: No problem, take care Sarah.`;

// ── Parse uploaded scorecard (plain text / CSV) ────────────────────────

export function parseScorecardFromText(text: string): Scorecard | null {
  const lines = text.trim().split("\n").filter(Boolean);
  const sections: ScorecardSection[] = [];
  let currentSection: ScorecardSection | null = null;
  const criticalFails: string[] = [];
  let inCritical = false;
  let title = "Custom Scorecard";

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    if (trimmed.toLowerCase().includes("scorecard") && title === "Custom Scorecard") {
      title = trimmed;
      continue;
    }

    if (trimmed.toLowerCase().includes("critical fail")) {
      inCritical = true;
      continue;
    }

    if (inCritical) {
      if (trimmed.startsWith("-") || trimmed.startsWith("•") || trimmed.match(/^\d+\./)) {
        criticalFails.push(trimmed.replace(/^[-•\d.]\s*/, ""));
      }
      continue;
    }

    // Try CSV parse: Section, Item, Criteria, Points
    const parts = trimmed.split(/[,\t]/).map((p) => p.trim());
    if (parts.length >= 4 && !isNaN(parseInt(parts[parts.length - 1]))) {
      const pts = parseInt(parts[parts.length - 1]);
      const criteria = parts.slice(2, parts.length - 1).join(", ");
      const sectionName = parts[0];
      const label = parts[1];

      if (!currentSection || currentSection.name !== sectionName) {
        currentSection = { name: sectionName, items: [] };
        sections.push(currentSection);
      }
      currentSection.items.push({
        id: `custom_${sections.length}_${currentSection.items.length}`,
        label,
        points: pts,
        criteria,
      });
    } else if (trimmed.endsWith(":") || trimmed.match(/^(section|step|phase|part)\s/i)) {
      currentSection = { name: trimmed.replace(/:$/, ""), items: [] };
      sections.push(currentSection);
    } else if (currentSection && trimmed.match(/\d+\s*(pts?|points?)/i)) {
      const pointsMatch = trimmed.match(/(\d+)\s*(pts?|points?)/i);
      const pts = pointsMatch ? parseInt(pointsMatch[1]) : 5;
      const label = trimmed.replace(/\s*[-–]\s*\d+\s*(pts?|points?).*/i, "").replace(/^[-•]\s*/, "");
      currentSection.items.push({
        id: `custom_${sections.length}_${currentSection.items.length}`,
        label,
        points: pts,
        criteria: trimmed,
      });
    }
  }

  if (sections.length === 0) {
    return null;
  }

  const totalPossible = sections.reduce(
    (t, s) => t + s.items.reduce((st, i) => st + i.points, 0),
    0
  );

  return {
    title,
    passingThreshold: Math.round(totalPossible * 0.85),
    totalPossible,
    scriptAdherence: "Evaluate based on substance and intent.",
    sections,
    criticalFails:
      criticalFails.length > 0
        ? criticalFails
        : ["No critical fail conditions defined"],
  };
}
