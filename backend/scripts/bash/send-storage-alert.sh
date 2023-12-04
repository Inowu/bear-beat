#!/bin/bash

# Function to get disk space information
get_disk_space() {
  df_output=$(df -h /)
  available_storage=$(echo "$df_output" | awk 'NR==2 {print $4}')
  used_storage=$(echo "$df_output" | awk 'NR==2 {print $3}')
}

# Get the formatted date
formatted_date=$(date +'%B %d, %Y')

# Set your Slack channel
channel="$SLACK_CHANNEL_ID"

# Get disk space information
get_disk_space

# Extract the numeric value from the available storage
available_storage_numeric=$(echo "$available_storage" | sed 's/[^0-9]*//g')

if [ "$available_storage_numeric" -lt 100 ]; then

# Slack message payload
slack_msg='{
  "channel": "'"$channel"'",
  "blocks": [
    {
      "type": "header",
      "text": {
        "type": "plain_text",
        "text": "[BEARBEAT] LOW STORAGE SPACE WARNING :warning:"
      }
    },
    {
      "type": "context",
      "elements": [
        {
          "text": "*'"$formatted_date"'*",
          "type": "mrkdwn"
        }
      ]
    },
    {
      "type": "divider"
    },
    {
      "type": "section",
      "text": {
        "type": "mrkdwn",
        "text": "*Available space left: *\n '"$available_storage"'"
      }
    },
    {
      "type": "section",
      "text": {
        "type": "mrkdwn",
        "text": "*Used space: *\n '"$used_storage"'"
      }
    }
  ]
}'

# Escape double quotes and newlines
escaped_slack_msg=$(echo "$slack_msg" | sed -e 's/"/\\"/g' -e ':a' -e 'N' -e '$!ba' -e 's/\n/\\n/g')

# Set your Slack API URL
slack_url="https://slack.com/api/chat.postMessage"

# Set your Slack API token
slack_token="$SLACK_API_TOKEN"

# Send the Slack message
curl -H "Content-type: application/json" \
  --data "$slack_msg" \
  -H "Authorization: Bearer $slack_token" \
  -X POST "$slack_url"
else
  echo "There is enough storage space left"
  exit 0
fi

