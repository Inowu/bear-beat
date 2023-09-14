#!/bin/bash

input_dir="/home/zcylla/Downloads"
output_dir="./demos"

# Ensure the output directory exists
mkdir -p "$output_dir"

# Use 'find' to locate all MP4 files in the input directory and its subdirectories
find "$input_dir" -type f -name "*.mp4" | while IFS= read -r file; do
    # Get the file name without the path
    filename=$(basename "$file")

    # Construct the output file path
    output_file="$output_dir/${filename%.*}.mp4"

    # Check if the output file already exists
    if [ -f "$output_file" ]; then
        echo "Skipped: $filename (Output file already exists)"
    else
        # Convert MP4 to MP3
        ffmpeg -to 60 -i "$file" -y -f mp4 "$output_file"
        echo "Processed: $filename"
    fi
done

