import { TextField } from "@mui/material";
import React from 'react';

interface ChatTextFieldProps {
    value: string;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onKeyDown: (e: React.KeyboardEvent<HTMLDivElement>) => void;
    disabled: boolean;
    placeholder: string;
    inputRef: React.RefObject<HTMLInputElement>;
    theme?: {
        textColor?: string;
    };
}

export const ChatTextField: React.FC<ChatTextFieldProps> = ({
    value,
    onChange,
    onKeyDown,
    disabled,
    placeholder,
    inputRef,
    theme
}) => {
    return (
        <TextField
            multiline
            maxRows={11}
            fullWidth
            disabled={disabled}
            value={value}
            onChange={onChange}
            onKeyDown={onKeyDown}
            placeholder={placeholder}
            variant="standard"
            inputRef={inputRef}
            sx={{
                overflowY: "auto",
                maxHeight: "calc(11 * 1.5em)",
                "& .MuiInput-root": {
                    margin: 0,
                    color: theme?.textColor,
                    "&:before, &:after": {
                        display: "none",
                    },
                    "&.Mui-disabled": {
                        cursor: "not-allowed",
                    },
                },
                "& .MuiInput-input": {
                    color: theme?.textColor,
                    "&::placeholder": {
                        color: `${theme?.textColor}99`,
                    },
                    padding: 0,
                    lineHeight: "1.5",
                    minHeight: "24px",
                    "&.Mui-disabled": {
                        cursor: "not-allowed",
                    },
                },
            }}
        />
    );
};