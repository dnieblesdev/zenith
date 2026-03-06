"""Script to find and display Python processes"""
import subprocess
import sys

def list_python_processes():
    try:
        # Run tasklist to find python.exe processes
        result = subprocess.run(
            ['tasklist', '/FI', 'IMAGENAME eq python.exe', '/V', '/FO', 'CSV'],
            capture_output=True,
            text=True
        )
        
        if result.returncode == 0:
            lines = result.stdout.strip().split('\n')
            print(f"Found {len(lines)-1} Python processes:\n")
            
            for i, line in enumerate(lines):
                if i == 0:  # Header
                    continue
                # Parse CSV line
                parts = line.split('","')
                if len(parts) >= 2:
                    name = parts[0].strip('"')
                    pid = parts[1].strip('"')
                    print(f"PID: {pid} - {name}")
                    
                    # Try to get more info
                    if 'zenith' in line.lower() or 'novelfire' in line.lower():
                        print(f"  ⚠️  This appears to be a stuck scraper process!")
            
            print("\n" + "="*60)
            print("To kill a process, run: taskkill /PID <PID_NUMBER> /F")
            print("Or use Task Manager: Ctrl+Shift+Esc -> Details tab -> Find python.exe")
            print("="*60)
        else:
            print("Could not list processes")
            
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    list_python_processes()
