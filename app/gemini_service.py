from google import genai
from PIL import Image
import json

# Initialize client
client = genai.Client(api_key="AIzaSyDrfoQiLsLGX91aFKykqNsgj6LWfhhRu_I")


def extract_receipt_data(image_path: str):
    image = Image.open(image_path)

    prompt = """
    Extract:
    - merchant name
    - total amount (number only)
    - date

    Return ONLY JSON. No explanation.
    """

    try:
        response = client.models.generate_content(
            model="gemini-1.0-pro-vision",
            contents=[prompt, image],
        )

        text = response.text.strip()
        print("RAW GEMINI:", text)

        data = json.loads(text)

        # SAFE PARSING
        merchant = data.get("merchant", "")
        amount = data.get("amount", 0)
        date = data.get("date", "")

        try:
            amount = float(amount)
        except:
            amount = 0

        return {
            "merchant": merchant,
            "amount": amount,
            "date": date
        }

    except Exception as e:
        return {"error": str(e)}