import os
from dotenv import load_dotenv
from langchain.chat_models import init_chat_model
from langchain.chat_models.base import _ConfigurableModel
from langchain_core.language_models import BaseChatModel


# 加载配置文件
load_dotenv(override=True)
DEEPSEEK_API_KEY = os.getenv('DEEPSEEK_API_KEY')
DEEPSEEK_BASE_URL = os.getenv('DEEPSEEK_BASE_URL')
DEEPSEEK_MODEL = os.getenv('DEEPSEEK_MODEL')

# _initialize_model
async def _initialize_model(api_key=DEEPSEEK_API_KEY, base_url=DEEPSEEK_BASE_URL, big_model=DEEPSEEK_MODEL) -> BaseChatModel | _ConfigurableModel:
    # 获取大模型
    model_ = init_chat_model(
        model_provider='deepseek',
        model=big_model,
        api_key=api_key,
        base_url=base_url
    )
    return model_