import asyncio
import logging
import sys
from pathlib import Path

# Add current folder to path to ensure clean imports
sys.path.append(str(Path(__file__).parent))

from agents.pipeline_orchestrator import PipelineOrchestrator

# Configure logging to console
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)]
)

async def main():
    print("=" * 60)
    print("Starting AgentVerse AI Agentic Pipeline Demo")
    print("=" * 60)
    
    orchestrator = PipelineOrchestrator()
    
    feature_request = "Build me a simple calendar which helps me remind task for the day"
    
    print(f"Running pipeline for feature request:\n'{feature_request}'\n")
    
    # Run the pipeline
    final_state = await orchestrator.run_pipeline(feature_request)
    
    print("\n" + "=" * 60)
    print("Pipeline Execution Complete!")
    print("=" * 60)
    print(f"Final Status: {final_state.get('status')}")
    print(f"Total Review Cycles: {final_state.get('review_cycle')}")
    print(f"Artifacts Generated:")
    
    for key, artifact in final_state.get("artifacts", {}).items():
        if artifact:
            print(f"  - {key}: {list(artifact.keys())}")
            
    print("\nRecorded Events:")
    for event in final_state.get("events", []):
        sender = event.get("sender", "Unknown")
        etype = event.get("event_type", "Unknown")
        pdata = event.get("payload_data", {})
        
        # Pull code file target or verdict if available
        details = ""
        if "verdict" in pdata:
            details = f" (Verdict: {pdata['verdict']})"
        elif "file_target" in pdata:
            details = f" (File: {pdata['file_target']})"
        elif "test_file" in pdata:
            details = f" (Test: {pdata['test_file']})"
            
        print(f"  [{event.get('timestamp')}] {sender} -> {etype}{details}")

if __name__ == "__main__":
    asyncio.run(main())
