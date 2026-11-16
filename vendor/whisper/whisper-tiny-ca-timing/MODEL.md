---
language:
- ca
license: apache-2.0
base_model: openai/whisper-tiny
tags:
- whisper-event
- generated_from_trainer
datasets:
- mozilla-foundation/common_voice_13_0
metrics:
- wer
model-index:
- name: Whisper Tiny Catalan
  results:
  - task:
      name: Automatic Speech Recognition
      type: automatic-speech-recognition
    dataset:
      name: mozilla-foundation/common_voice_13_0 ca
      type: mozilla-foundation/common_voice_13_0
      config: ca
      split: test
      args: ca
    metrics:
    - name: Wer
      type: wer
      value: 16.904258359531294
---

# Whisper Tiny Catalan

## Model summary

**Whisper Tiny Catalan** is an automatic speech recognition (ASR) model for **Catalan (ca)** speech. It is fine-tuned from [openai/whisper-tiny] on the **Catalan subset of Mozilla Common Voice 13.0**, achieving a **Word Error Rate (WER) of 16.90%** on the evaluation split.

This model is intended for general-purpose transcription of Catalan audio.

---

## Model description

* **Architecture:** Transformer-based encoder–decoder (Whisper)  
* **Base model:** openai/whisper-tiny  
* **Language:** Catalan (ca)  
* **Task:** Automatic Speech Recognition (ASR)  
* **Output:** Text transcription in Catalan  
* **Decoding:** Autoregressive sequence-to-sequence decoding  

Fine-tuned to improve transcription quality on Catalan audio, leveraging Whisper’s multilingual pretraining.

---

## Intended use

### Primary use cases

* Transcription of Catalan audio recordings  
* Offline or batch ASR pipelines  
* Research and development in Catalan ASR  
* Educational and media applications  

### Out-of-scope use

* Real-time or low-latency ASR without optimization  
* Speech translation tasks  
* Safety-critical applications without further validation  

---

## Limitations and known issues

* Performance may degrade on:
  * Noisy or low-quality recordings  
  * Conversational or spontaneous speech  
  * Dialects underrepresented in Common Voice  
* Dataset biases may be reflected in outputs  
* Occasional transcription errors can occur under difficult acoustic conditions  

---

## Training and evaluation data

* **Dataset:** Mozilla Common Voice 13.0 (Catalan subset)  
* **Data type:** Crowd-sourced, read speech  
* **Preprocessing:**  
  * Audio resampled to 16 kHz  
  * Text normalized using Whisper tokenizer  
  * Filtering of invalid or problematic samples  

* **Evaluation metric:** Word Error Rate (WER) on held-out evaluation set  

---

## Evaluation results

| Metric     | Value      |
| ---------- | ---------- |
| WER (eval) | **16.90%** |

---

## Training procedure

### Training hyperparameters

* Learning rate: 3.75e-5  
* Optimizer: Adam (β1=0.9, β2=0.999, ε=1e-8)  
* LR scheduler: Linear  
* Warmup steps: 500  
* Training steps: 5,000  
* Train batch size: 256  
* Eval batch size: 128  
* Seed: 42  

### Training results (summary)

| Training Loss | Epoch | Step | Validation Loss | WER     |
|:-------------:|:-----:|:----:|:---------------:|:-------:|
| 0.2098        | 7.02  | 1000 | 0.3994          | 22.5047 |
| 0.162         | 15.02 | 2000 | 0.3454          | 19.4181 |
| 0.0662        | 23.01 | 3000 | 0.3526          | 18.5687 |
| 0.0934        | 31.01 | 4000 | 0.3312          | 18.1600 |
| 0.1167        | 39.0  | 5000 | 0.3180          | 16.9043 |

---

## Framework versions

- Transformers 4.33.0.dev0  
- PyTorch 2.0.1+cu117  
- Datasets 2.14.4  
- Tokenizers 0.13.3  

---

## How to use

```python
from transformers import pipeline

hf_model = "HiTZ/whisper-tiny-ca"  # replace with actual repo ID
device = 0  # set to -1 for CPU

pipe = pipeline(
    task="automatic-speech-recognition",
    model=hf_model,
    device=device
)

result = pipe("audio.wav")
print(result["text"])
```

---

## Ethical considerations and risks

* This model transcribes speech and may process personal data.
* Users should ensure compliance with applicable data protection laws (e.g., GDPR).
* The model should not be used for surveillance or non-consensual audio processing.

---

## Citation

If you use this model in your research, please cite:

```bibtex
@misc{dezuazo2025whisperlmimprovingasrmodels,
  title={Whisper-LM: Improving ASR Models with Language Models for Low-Resource Languages},
  author={Xabier de Zuazo and Eva Navas and Ibon Saratxaga and Inma Hernáez Rioja},
  year={2025},
  eprint={2503.23542},
  archivePrefix={arXiv},
  primaryClass={cs.CL}
}
```

Please, check the related paper preprint in
[arXiv:2503.23542](https://arxiv.org/abs/2503.23542)
for more details.

---

## License

This model is available under the
[Apache-2.0 License](https://www.apache.org/licenses/LICENSE-2.0).
You are free to use, modify, and distribute this model as long as you credit
the original creators.

---

## Contact and attribution

* Fine-tuning and evaluation: HiTZ/Aholab - Basque Center for Language Technology
* Base model: OpenAI Whisper
* Dataset: Mozilla Common Voice

For questions or issues, please open an issue in the model repository.
