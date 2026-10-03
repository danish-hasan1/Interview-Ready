"""Interview Ready V1 - Streamlit UI. Run: streamlit run app.py"""
import streamlit as st

from interview_ready import config
from interview_ready.claims import OWNERSHIP_LEVELS, extract_claims
from interview_ready.db import Store
from interview_ready.gaps import analyse_gaps, gap_questions
from interview_ready.interview import Interview, build_queue
from interview_ready.parsing import extract_text
from interview_ready.scoring import DIMENSIONS

st.set_page_config(page_title="Interview Ready", layout="wide")


@st.cache_resource
def store() -> Store:
    return Store()


db = store()
ss = st.session_state
ss.setdefault("claims", [])
ss.setdefault("gaps", [])
ss.setdefault("interview", None)
ss.setdefault("session_id", None)
ss.setdefault("feedback", [])

st.sidebar.title("Interview Ready")
page = st.sidebar.radio("Go to", ["1. Inputs", "2. CV claims", "3. Gap analysis", "4. Mock interview", "5. Profile"])
st.sidebar.caption(f"Model backend: **{config.LLM_BACKEND}** (rules-first, no external calls)")

if page == "1. Inputs":
    st.header("Upload CV and job description")
    cv_file = st.file_uploader("CV (PDF / DOCX / TXT)", type=["pdf", "docx", "txt", "md"])
    jd_file = st.file_uploader("Job description (optional upload)", type=["pdf", "docx", "txt", "md"])
    jd_paste = st.text_area("...or paste the JD", height=200)
    notes = st.text_area("Interviewer / company notes (optional)", height=80)
    if st.button("Analyse", type="primary"):
        cv_doc = db.latest_document("cv")
        cv_text = None
        if cv_file:
            cv_text = extract_text(cv_file.name, cv_file.getvalue())
            db.add_document("cv", cv_file.name, cv_text)
        elif cv_doc:
            cv_text = cv_doc["text"]
        jd_text = jd_paste.strip()
        if jd_file:
            jd_text = extract_text(jd_file.name, jd_file.getvalue())
        if jd_text:
            db.add_document("jd", "jd", jd_text)
        if not cv_text:
            st.error("Upload a CV first.")
        else:
            doc = db.latest_document("cv")
            ss["claims"] = extract_claims(cv_text)
            db.replace_claims(doc["id"], ss["claims"])
            ss["gaps"] = analyse_gaps(cv_text, jd_text) if jd_text else []
            ss["notes"] = notes
            st.success(f"{len(ss['claims'])} claims found, {len(ss['gaps'])} JD requirements checked. See next tabs.")

elif page == "2. CV claims":
    st.header("CV claim inventory")
    if not ss["claims"]:
        st.info("Run Analyse on the Inputs tab first.")
    for i, c in enumerate(ss["claims"]):
        with st.expander(f"[{c.type}] {c.text}"):
            c.ownership = st.selectbox("Your ownership", OWNERSHIP_LEVELS, index=OWNERSHIP_LEVELS.index(c.ownership), key=f"own{i}")
            from interview_ready.claims import build_questions
            c.questions = build_questions(c)
            if c.numbers:
                st.caption("Numbers: " + ", ".join(c.numbers))
            for q in c.questions:
                st.write("• " + q)

elif page == "3. Gap analysis":
    st.header("CV vs JD gaps")
    if not ss["gaps"]:
        st.info("Paste a JD and run Analyse first.")
    icon = {"missing": "🔴", "weak": "🟡", "evidenced": "🟢"}
    for g in ss["gaps"]:
        with st.expander(f"{icon[g.status]} {g.status.upper()} - {g.requirement}"):
            st.caption(f"Keyword coverage {int(g.coverage * 100)}%")
            for e in g.evidence:
                st.write("CV evidence: " + e)

elif page == "4. Mock interview":
    st.header("Mock interview (text)")
    if not ss["claims"] and not ss["gaps"]:
        st.info("Run Analyse first.")
    else:
        iv: Interview = ss["interview"]
        if st.button("Restart" if iv else "Start interview", type="primary"):
            queue = build_queue(ss["claims"], gap_questions(ss["gaps"]))
            if not queue:
                st.warning("No questions could be built from this CV.")
            else:
                iv = ss["interview"] = Interview(queue)
                iv.start()
                ss["session_id"] = db.new_session(notes=ss.get("notes", ""))
                ss["feedback"] = []
                st.rerun()
        if iv is not None:
            for q, a, sc in ss["feedback"]:
                st.chat_message("assistant").write(q)
                st.chat_message("user").write(a)
                with st.chat_message("assistant"):
                    st.markdown(f"**Score {sc.total}/10** — " + " · ".join(f"{d}: {sc.dims[d]}" for d in DIMENSIONS))
                    if sc.framework:
                        st.caption("Framework detected: " + sc.framework)
                    for f in sc.fixes:
                        st.write("• " + f)
            if iv.done:
                st.success("Interview finished. Scores saved. See Profile.")
            else:
                st.chat_message("assistant").write(iv.current.question)
                ans = st.chat_input("Your answer")
                if ans:
                    turn = iv.current
                    score, _ = iv.answer(ans)
                    db.save_answer(ss["session_id"], turn.question, turn.kind, ans, score)
                    ss["feedback"].append((turn.question, ans, score))
                    st.rerun()

elif page == "5. Profile":
    st.header("Progress")
    sums = db.session_summaries()
    if not sums:
        st.info("No sessions yet.")
    else:
        st.line_chart({"avg score": [s["avg_total"] for s in sums]})
        st.table(sums)
        st.subheader("Weakest dimensions")
        for d, v in db.weaknesses():
            st.write(f"**{d}**: {v}/10")
    st.divider()
    st.subheader("Your data")
    import json
    st.download_button("Export all my data (JSON)", json.dumps(db.export_all(), indent=2), "interview_ready_export.json")
    if st.checkbox("I understand this deletes everything permanently") and st.button("Delete all my data"):
        db.delete_all()
        for k in ("claims", "gaps", "interview", "session_id", "feedback"):
            ss.pop(k, None)
        st.success("Deleted.")
