import sys
import json
import hashlib
from tree_sitter import Language, Parser
import tree_sitter_solidity

class SentialSemanticChunker:
    def __init__(self):
        self.SOLIDITY_LANGUAGE = Language(tree_sitter_solidity.language())
        self.parser = Parser(self.SOLIDITY_LANGUAGE)

    def generate_chunk_id(self, entity_name: str) -> str:
        return hashlib.sha256(entity_name.encode()).hexdigest()[:12]

    def extract_node_text(self, node, source_bytes: bytes) -> str:
        return source_bytes[node.start_byte:node.end_byte].decode('utf-8')

    def _extract_chunks(self, source_code: str, is_virtual: bool = False):
        """Internal method to perform the AST traversal."""
        source_bytes = source_code.encode('utf-8')
        tree = self.parser.parse(source_bytes)
        root_node = tree.root_node
        
        chunks = []
        imports = []

        for child in root_node.children:
            if child.type == 'import_directive':
                imports.append(self.extract_node_text(child, source_bytes))
                
            elif child.type in ['contract_declaration', 'interface_declaration', 'library_declaration']:
                
                # If virtual framing is active, mask the dummy name
                contract_name = "UserSnippet" if is_virtual else "AnonymousEntity"
                
                if not is_virtual:
                    name_node = child.child_by_field_name('name')
                    if not name_node:
                        name_node = next((n for n in child.children if n.type == 'identifier'), None)
                    if name_node:
                        contract_name = self.extract_node_text(name_node, source_bytes)

                body_node = next((n for n in child.children if n.type == 'contract_body'), None)
                if not body_node: 
                    continue
                
                for item in body_node.children:
                    entity_type = None
                    entity_name = "anonymous"

                    # Parse Functions
                    if item.type == 'function_definition':
                        entity_type = 'function'
                        name_node = item.child_by_field_name('name')
                        if not name_node:
                            name_node = next((n for n in item.children if n.type == 'identifier'), None)
                        
                        if name_node: 
                            entity_name = self.extract_node_text(name_node, source_bytes)
                        else:
                            raw_text = self.extract_node_text(item, source_bytes).lower()
                            if 'constructor' in raw_text[:20]:
                                entity_name = 'constructor'
                            else:
                                entity_name = 'fallback_receive'
                            
                    # Parse Modifiers
                    elif item.type == 'modifier_definition':
                        entity_type = 'modifier'
                        name_node = item.child_by_field_name('name')
                        if not name_node:
                            name_node = next((n for n in item.children if n.type == 'identifier'), None)
                            
                        if name_node: 
                            entity_name = self.extract_node_text(name_node, source_bytes)
                            
                    # Parse State Variables
                    elif item.type == 'state_variable_declaration':
                        entity_type = 'state_variable'
                        name_node = item.child_by_field_name('name')
                        if not name_node:
                            name_node = next((n for n in item.children if n.type == 'identifier'), None)
                        
                        if name_node:
                            entity_name = self.extract_node_text(name_node, source_bytes)
                        else:
                            entity_name = f"state_var_{item.start_byte}"

                    # Append identified structural block
                    if entity_type:
                        chunk_text = self.extract_node_text(item, source_bytes)
                        chunks.append({
                            "id": self.generate_chunk_id(f"{contract_name}_{entity_name}"),
                            "contract_name": contract_name,
                            "entity_type": entity_type,
                            "entity_name": entity_name,
                            "code": chunk_text
                        })

        return {"imports": imports, "chunks": chunks}

    def parse_code(self, source_code: str):
        """The main ingestion pipeline with Virtual Framing fallbacks."""
        
        # 1. Standard Execution
        result = self._extract_chunks(source_code)
        
        # 2. THE VIRTUAL FRAMER (Heuristic Fallback for broken/partial snippets)
        if not result["chunks"]:
            # Wrap the raw code in a dummy structure so the AST can map the logic
            virtual_code = f"pragma solidity ^0.8.0;\ncontract SentialVirtual {{\n{source_code}\n}}"
            virtual_result = self._extract_chunks(virtual_code, is_virtual=True)
            
            # If the Virtual Framer successfully mapped the logic, use it
            if virtual_result["chunks"]:
                return virtual_result
                
        # 3. Absolute Shatterproof Fallback (If the code is pure gibberish)
        if not result["chunks"]:
            result["chunks"].append({
                "id": self.generate_chunk_id("global_fallback"),
                "contract_name": "Global/Snippet",
                "entity_type": "raw_snippet",
                "entity_name": "unstructured_block",
                "code": source_code.strip()
            })

        return result

if __name__ == "__main__":
    try:
        input_code = sys.stdin.read()
        
        if not input_code.strip():
            print(json.dumps({"error": "No code provided to the chunker."}))
            sys.exit(1)

        chunker = SentialSemanticChunker()
        result = chunker.parse_code(input_code)
        
        print(json.dumps(result))
        
    except Exception as e:
        fallback_code = input_code[:5000] + "\n\n...[TRUNCATED DUE TO PARSE ERROR]" if len(input_code) > 5000 else input_code
        print(json.dumps({"error": str(e), "chunks": [{"entity_type": "raw_fallback", "entity_name": "error_recovery", "code": fallback_code}]}))
        sys.exit(1)