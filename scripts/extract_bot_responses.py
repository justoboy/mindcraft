#!/usr/bin/env python3
"""
Script to extract bot-generated responses and system responses/errors from MINDcraft log files.

This script processes a log file and extracts:
1. Bot-generated responses (lines containing "Generated response:")
2. System responses/errors (lines containing "Agent executed:", "Error:", "Action output:", etc.)

The output preserves the original order from the log file.
"""

import os
import re
from pathlib import Path


def is_bot_response(line: str) -> bool:
    """
    Check if a line contains a bot-generated response.
    
    Args:
        line: A single line from the log file
        
    Returns:
        True if the line contains a bot response, False otherwise
    """
    return line.startswith('Generated response:')


def is_blaze_full_response(line: str) -> bool:
    """
    Check if a line is a Blaze full response (duplicate of Generated response).
    
    Args:
        line: A single line from the log file
        
    Returns:
        True if the line is a Blaze full response, False otherwise
    """
    return line.startswith('Blaze full response to system:')


def is_received_message(line: str) -> bool:
    """
    Check if a line is a received message from system or player.
    
    Args:
        line: A single line from the log file
        
    Returns:
        True if the line is a received message, False otherwise
    """
    return line.startswith('received message from system :') or line.startswith('received message from justoboy13 :')


def is_agent_executed_block_start(line: str) -> bool:
    """
    Check if a line starts an Agent executed block.
    
    Args:
        line: A single line from the log file
        
    Returns:
        True if the line starts an Agent executed block, False otherwise
    """
    return line.startswith('Agent executed:')


def is_agent_executed_block_terminator(line: str) -> bool:
    """
    Check if a line terminates an Agent executed block.
    
    Args:
        line: A single line from the log file
        
    Returns:
        True if the line terminates an Agent executed block, False otherwise
    """
    return line.startswith('Saved memory to:') or line.startswith('Storing memories')


def is_error_block_start(line: str) -> bool:
    """
    Check if a line starts an Error block.
    
    Args:
        line: A single line from the log file
        
    Returns:
        True if the line starts an Error block, False otherwise
    """
    return line.startswith('Error:') or line.startswith('Code execution triggered catch:')


def is_error_block_terminator(line: str) -> bool:
    """
    Check if a line terminates an Error block (blank line or start of another recognized block).
    
    Args:
        line: A single line from the log file
        
    Returns:
        True if the line terminates an Error block, False otherwise
    """
    if not line.strip():
        return True
    if line.startswith('Generated response:') or line.startswith('Blaze full response'):
        return True
    if line.startswith('Agent executed:'):
        return True
    if line.startswith('Error:') or line.startswith('Code execution triggered catch:'):
        return True
    return False


def is_other_system_output(line: str) -> bool:
    """
    Check if a line is other system output that should be included.
    
    Args:
        line: A single line from the log file
        
    Returns:
        True if the line is other system output, False otherwise
    """
    return line.startswith('Action output:')


def is_wanted_line(line: str) -> bool:
    """
    Check if a line is a "wanted" line that should be included in output.
    These are lines that can restart the skipping of intermediate lines.
    
    Args:
        line: A single line from the log file
        
    Returns:
        True if the line is a wanted line, False otherwise
    """
    return (is_bot_response(line) or 
            is_blaze_full_response(line) or 
            is_received_message(line) or
            is_agent_executed_block_start(line) or
            is_error_block_start(line))


def extract_log_content(input_path: str, output_path: str) -> None:
    """
    Extract bot responses and system outputs from a log file.
    
    This function reads the input log file line by line (memory efficient)
    and writes filtered content to the output file preserving the original order.
    
    Args:
        input_path: Path to the input log file
        output_path: Path to the output filtered log file
        
    Raises:
        FileNotFoundError: If the input file does not exist
        IOError: If there are read/write errors
    """
    # Validate input file exists
    input_file = Path(input_path)
    if not input_file.exists():
        raise FileNotFoundError(f"Input log file not found: {input_path}")
    
    # Ensure output directory exists
    output_file = Path(output_path)
    output_file.parent.mkdir(parents=True, exist_ok=True)
    
    # Collect filtered content in order
    filtered_lines = []
    
    try:
        with open(input_file, 'r', encoding='utf-8') as f:
            lines = f.readlines()
        
        i = 0
        while i < len(lines):
            line = lines[i].rstrip('\n\r')
            
            # Skip empty lines
            if not line.strip():
                i += 1
                continue
            
            # Check for bot response (Generated response:)
            if is_bot_response(line):
                # Skip duplicate Blaze full response to system: lines
                if is_blaze_full_response(line):
                    i += 1
                    continue
                
                # This is a Generated response line
                filtered_lines.append(line)
                i += 1
                continue
            
            # Check for Blaze full response to system: (duplicate to skip)
            if is_blaze_full_response(line):
                i += 1
                continue
            
            # Check for received message
            if is_received_message(line):
                filtered_lines.append(line)
                i += 1
                continue
            
            # Check for Agent executed: block (multiline)
            if is_agent_executed_block_start(line):
                block_lines = [line]
                i += 1
                # Collect lines until terminator (Saving memory to: or Storing memories)
                while i < len(lines):
                    block_line = lines[i].rstrip('\n\r')
                    if is_agent_executed_block_terminator(block_line):
                        break
                    block_lines.append(block_line)
                    i += 1
                filtered_lines.extend(block_lines)
                # Skip lines until next wanted line
                while i < len(lines):
                    next_line = lines[i].rstrip('\n\r')
                    if not next_line.strip():
                        i += 1
                        continue
                    if is_wanted_line(next_line):
                        break
                    i += 1
                continue
            
            # Check for Error: block (multiline with stack trace)
            if is_error_block_start(line):
                block_lines = [line]
                i += 1
                # Collect lines until terminator
                while i < len(lines):
                    block_line = lines[i].rstrip('\n\r')
                    if is_error_block_terminator(block_line):
                        break
                    block_lines.append(block_line)
                    i += 1
                filtered_lines.extend(block_lines)
                # Skip lines until next wanted line
                while i < len(lines):
                    next_line = lines[i].rstrip('\n\r')
                    if not next_line.strip():
                        i += 1
                        continue
                    if is_wanted_line(next_line):
                        break
                    i += 1
                continue
            
            # Check for other system output
            if is_other_system_output(line):
                filtered_lines.append(line)
                i += 1
                continue
            
            # Skip all other lines
            i += 1
    
    except IOError as e:
        raise IOError(f"Error reading input file {input_path}: {e}")
    
    # Write filtered content to output file
    try:
        with open(output_file, 'w', encoding='utf-8') as f:
            for line in filtered_lines:
                f.write(line + '\n')
    
    except IOError as e:
        raise IOError(f"Error writing to output file {output_path}: {e}")


def main():
    """Main entry point for the script."""
    # Define paths relative to the script's directory
    script_dir = Path(__file__).parent.parent
    input_log = script_dir / "logs" / "log_0.txt"
    output_log = script_dir / "logs" / "filtered_log.txt"
    
    print(f"MINDcraft Log Extractor")
    print(f"=" * 40)
    print(f"Input file: {input_log}")
    print(f"Output file: {output_log}")
    print()
    
    try:
        extract_log_content(str(input_log), str(output_log))
        print(f"Successfully extracted log content to: {output_log}")
        print("Done!")
        
    except FileNotFoundError as e:
        print(f"Error: {e}")
        print("Please ensure the input log file exists.")
        return 1
        
    except IOError as e:
        print(f"Error: {e}")
        return 1
        
    except Exception as e:
        print(f"Unexpected error: {e}")
        return 1
    
    return 0


if __name__ == "__main__":
    exit(main())
